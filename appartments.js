import puppeteer from 'puppeteer'
import {
  checkAlreadyScrapped,
  closeJsonFile,
  generateExport,
  replaceLastPart,
  writeToFile,
  writeToLog,
} from './helper.js'
var rootUrl
var county
var targetUrl
var browser
var page
var mheadless = Boolean(!process.argv[2])
const site = 'appartments'
var folderName =
  site +
  '/' +
  new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll(':', '-')
    .replaceAll('T', '--')

const originalConsoleLog = console.log
console.log = function (message) {
  originalConsoleLog(message)
  writeToLog(folderName, message)
}

const init = async () => {
  writeToFile(folderName, null, true)
  let length = 1
  browser = await puppeteer.launch({
    headless: mheadless,
    defaultViewport: null,
    userDataDir: './tmp',
  })

  page = await browser.newPage()
  await page.goto(rootUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 0,
  })
  const paginationLinks = await page.$$('p.searchResults > span.pageRange')
  if (paginationLinks.length > 0) {
    try {
      let totalPage = await page.evaluate(
        (el) => el.textContent,
        paginationLinks[0]
      )
      length = totalPage.split(' ').pop()
    } catch (e) {
      console.log(e)
    }
  } else {
    length = 1
  }

  await browser.close()
  console.log(`Total Pagination Page : ${length}`)
  for (var i = 1; i <= length; i++) {
    browser = await puppeteer.launch({
      headless: mheadless,
      defaultViewport: null,
      userDataDir: './tmp',
    })
    targetUrl = `${rootUrl}${i}/`
    await getDataPerPaginationPage(targetUrl, i)
    await browser.close()
  }
  closeJsonFile(folderName)
  console.log('Folder Name:' + folderName)
  generateExport(folderName)
}

const getDataPerPaginationPage = async (targetUrl, page) => {
  console.log('Scrapping Page: ' + targetUrl)
  var addressData
  var paginationPage = await browser.newPage()
  await paginationPage.goto(targetUrl, {
    waitUntil: 'networkidle0',
    timeout: 0,
  })
  const propertyCards = await paginationPage.$$('div.placardContainer>ul>li')
  console.log('Total Property in this page: ' + propertyCards.length)

  for (const [i, propertyCard] of propertyCards.entries()) {
    let dataUrl = await paginationPage.evaluate(
      (el) => el.querySelector('article').getAttribute('data-url'),
      propertyCard
    )
    if (dataUrl) {
      const parts = dataUrl.split('/')
      const id = parts[parts.length - 2]
      var alreadyScrapped = checkAlreadyScrapped(id, site)
      if (!alreadyScrapped) {
        let detailObj = {
          Url: dataUrl,
          County: county,
        }
        await detail(dataUrl, detailObj, i + 1, page)
      } else {
        console.log(`scrapping skipped ${page} >> ${i + 1}.... ${targetUrl}`)
      }
    }
  }
  console.log('Complete Scrapping Page: ' + targetUrl)
  await paginationPage.close()
}

const detail = async (targetUrl, pObj, index = 0, page = 1) => {
  console.log(`scrapping ${page} >> ${index}.... ${targetUrl}`)
  var detailPage = await browser.newPage()
  await detailPage.goto(targetUrl, {
    waitUntil: 'networkidle0',
    timeout: 0,
  })

  let state = await detailPage.evaluate(() => {
    const span = document.querySelector(
      '#breadcrumbs-container>span:nth-child(2)'
    )
    return span.textContent
  })
  pObj['State'] = state

  let city = await detailPage.evaluate(() => {
    const span = document.querySelector(
      '#breadcrumbs-container>span:nth-child(4)'
    )
    return span.textContent
  })
  pObj['City'] = city
  let street = await detailPage.evaluate(() => {
    const span = document.querySelector(
      '#breadcrumbs-container>span:last-child'
    )
    return span.textContent
  })
  pObj['Street'] = street

  let zipcode = await detailPage.evaluate(() => {
    const span = document.querySelector(
      'div#propertyAddressRow > div > h2 > span.stateZipContainer > span:nth-child(2)'
    )
    return span.textContent
  })
  pObj['Zip Code'] = zipcode

  try {
    var price = await detailPage.evaluate(() => {
      const priceTag = document.querySelector(
        '#priceBedBathAreaInfoWrapper > div > div > ul > li:nth-child(1) > div > p.rentInfoDetail'
      )
      return priceTag.textContent
    })
    pObj['Rental Price'] = price.replaceAll(',', '')
  } catch (e) {
    pObj['Rental Price'] = '-'
  }
  try {
    var bed = await detailPage.evaluate(() => {
      const bedTag = document.querySelector(
        '#priceBedBathAreaInfoWrapper > div > div > ul > li:nth-child(2) > div > p.rentInfoDetail'
      )
      return bedTag.textContent
    })
    pObj['Number of Bedrooms'] = bed
  } catch (e) {
    pObj['Number of Bedrooms'] = '-'
  }
  try {
    var bath = await detailPage.evaluate(() => {
      const bathTag = document.querySelector(
        '#priceBedBathAreaInfoWrapper > div > div > ul > li:nth-child(3) > div > p.rentInfoDetail'
      )
      return bathTag.textContent
    })
    pObj['Number of Bathrooms'] = bath
  } catch (e) {
    pObj['Number of Bathrooms'] = '-'
  }
  try {
    var sqft = await detailPage.evaluate(() => {
      const sqftTag = document.querySelector(
        '#priceBedBathAreaInfoWrapper > div > div > ul > li:nth-child(4) > div > p.rentInfoDetail'
      )
      return sqftTag.textContent
    })
    pObj['Square Feet'] = sqft.replaceAll(',', '')
  } catch (e) {
    pObj['Square Feet'] = '-'
  }
  pObj['Year Built'] = '--'
  pObj['Building Type'] = '--'

  const liSpecInfos = await detailPage.$$('li.specInfo')
  var specInfos = []
  for (const [j, specInfo] of liSpecInfos.entries()) {
    try {
      let key = await detailPage.evaluate(
        (el) => el.querySelector('span').textContent,
        specInfo
      )
      specInfos.push(key)
    } catch (e) {}
  }
  var internetIncl = null,
    refrigeratorIncl = null,
    washerIncl = null,
    dryerIncl = null,
    dishwasherIncl = null,
    microwaveIncl = null,
    patioIncl = null,
    garageIncl = null,
    parkingIncl = null,
    poolIncl = null,
    cableIncl = null,
    iniblindsIncl = null,
    balconyIncl = null,
    deckIncl = null,
    airconIncl = null,
    stoveIncl = null,
    ceilingFanIncl = null,
    gatedIncl = null,
    electricIncl = null,
    gasIncl = null,
    waterIncl = null,
    sewerIncl = null,
    trashIncl = null,
    cableTvIncl = null,
    radiantIncl = null,
    waterHeaterIncl = null,
    garbageIncl = null,
    backPorchIncl = null,
    backyardIncl = null,
    frontYardIncl = null,
    frontPorchIncl = null,
    pestcontrolIncl = null,
    flatEntryIncl = null,
    rampedEntryIncl = null,
    heatIncl = null,
    doorsIncl = null,
    heaterTxt = null,
    interiorsTxt = null,
    appliancesTxt = null,
    feesTxt = null

  for (let index = 0; index < specInfos.length; index++) {
    const value = specInfos[index]

    if (value.toLowerCase().replaceAll(' ', '').includes('highspeedinternet')) {
      internetIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('cableready')) {
      cableIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('refrigerator')) {
      refrigeratorIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('washer')) {
      washerIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('dryer')) {
      dryerIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('dishwasher')) {
      dishwasherIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('microwave')) {
      microwaveIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('patio')) {
      patioIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('garage')) {
      garageIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('parking')) {
      parkingIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('pool')) {
      poolIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('iniblinds')) {
      iniblindsIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('balcony')) {
      balconyIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('deck')) {
      deckIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('gated')) {
      gatedIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('aircondition')) {
      airconIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('ceilingfan')) {
      ceilingFanIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('stove')) {
      stoveIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('water')) {
      waterIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('sewer')) {
      sewerIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('electric')) {
      electricIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('gas')) {
      gasIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('waterheater')) {
      waterHeaterIncl = 'Yes'
    }

    if (value.toLowerCase().replaceAll(' ', '').includes('trashpickup')) {
      trashIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('cabletelevision')) {
      cableTvIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('radiant')) {
      radiantIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('garbagedisposal')) {
      garbageIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('backporch')) {
      backPorchIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('fencedbackyard')) {
      backyardIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('fencedfrontyard')) {
      frontYardIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('frontporch')) {
      frontPorchIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('pestcontrol')) {
      pestcontrolIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('flatentry')) {
      flatEntryIncl = 'Yes'
    }
    if (value.toLowerCase().replaceAll(' ', '').includes('rampedentry')) {
      rampedEntryIncl = 'Yes'
    }
  }

  pObj['High Speed Internet - Included with Rent'] = internetIncl
  pObj['Electric - Included with Rent'] = electricIncl
  pObj['Gas - Included with Rent'] = gasIncl
  pObj['Water - Included with Rent'] = waterIncl
  pObj['Sewer - Included with Rent'] = sewerIncl
  pObj['Trash Pickup - Included with Rent'] = trashIncl
  pObj['Cable Television - Included with Rent'] = cableTvIncl
  pObj['Radiant - Included with Rent'] = radiantIncl
  pObj['Heat - Included with Rent'] = heatIncl
  pObj['Refrigerator'] = refrigeratorIncl
  pObj['Washer'] = washerIncl
  pObj['Dryer'] = dryerIncl
  pObj['Dishwasher'] = dishwasherIncl
  pObj['Microwave'] = microwaveIncl
  pObj['Patio'] = patioIncl
  pObj['Air Conditioner'] = airconIncl
  pObj['Garage'] = garageIncl
  pObj['Parking'] = parkingIncl
  pObj['Pool'] = poolIncl
  pObj['Stove Type'] = stoveIncl
  pObj['Water Heater'] = waterHeaterIncl
  pObj['Cable Ready'] = cableIncl
  pObj['Ceiling Fan'] = ceilingFanIncl
  pObj['Garbage Disposal'] = garbageIncl
  pObj['Miniblinds'] = iniblindsIncl
  pObj['Back Porch'] = backPorchIncl
  pObj['Balcony'] = balconyIncl
  pObj['Deck'] = deckIncl
  pObj['Fenced Backyard'] = backyardIncl
  pObj['Fenced Front Yard'] = frontYardIncl
  pObj['Front Porch'] = frontPorchIncl
  pObj['Pest Control'] = pestcontrolIncl
  pObj["32'' doors"] = doorsIncl
  pObj['Flat entry'] = flatEntryIncl
  pObj['Ramped entry'] = rampedEntryIncl
  pObj['Gated Community'] = gatedIncl
  pObj['Heater'] = heaterTxt
  pObj['Interior features'] = interiorsTxt
  pObj['Appliances included'] = appliancesTxt
  pObj['Fees Include'] = feesTxt
  await detailPage.close()
  writeToFile(folderName, pObj)
}

const counties = [
  'bexar-county-tx',
  'mclennan-county-tx',
  'cooke-county-tx',
  'fannin-county-tx',
  'grayson-county-tx',
  'georgia',
  'tennessee',
  'new-york',
]
const scrap = async (mcounty, index) => {
  county = mcounty
  if (index != 0) {
    folderName = replaceLastPart(folderName, county)
  } else {
    folderName += `/${county}`
  }
  rootUrl = `https://www.apartments.com/${county}/`
  targetUrl = rootUrl
  console.log(`Scrapping Start : ${county} : ${new Date().toISOString()}`)
  await init()
  console.log(`Scrapping End : ${county} : ${new Date().toISOString()}`)
  console.log('-------')
}

async function processCounties(array) {
  for (const [index, item] of array.entries()) {
    await scrap(item, index)
  }
}
processCounties(counties)
