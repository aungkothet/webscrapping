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
const site = 'compass'
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
  const paginationLinks = await page.$$(
    'a.uc-lolCardViewPaginator-cancelAnchorAppearance'
  )
  try {
    length = await page.evaluate(
      (el) => el.textContent,
      paginationLinks[paginationLinks.length - 1]
    )
  } catch (e) {
    console.log(e)
  }
  await browser.close()
  console.log(`Total Pagination Page : ${length}`)
  for (var i = 1; i <= length; i++) {
    browser = await puppeteer.launch({
      headless: mheadless,
      defaultViewport: null,
      userDataDir: './tmp',
    })
    if (i != 1) {
      targetUrl = rootUrl + 'start=' + (i - 1) * 41 + '/'
    }
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
  const propertyCards = await paginationPage.$$('div.uc-listingPhotoCard')
  console.log('Total Property in this page: ' + propertyCards.length)

  for (const [i, propertyCard] of propertyCards.entries()) {
    let isProperty = await paginationPage.evaluate(
      (el) => !!el.querySelector('div.uc-listingPhotoCard-body'),
      propertyCard
    )
    if (isProperty) {
      addressData = await paginationPage.evaluate((el) => {
        const scriptTags = Array.from(
          el.querySelectorAll('script[type="application/ld+json"]')
        )
        return JSON.parse(scriptTags[0].textContent)
      }, propertyCard)

      const parts = addressData.url.split('/')
      const id = parts[parts.length - 1]
      var alreadyScrapped = checkAlreadyScrapped(id, site)
      if (!alreadyScrapped) {
        let detailObj = {
          Url: addressData.url,
          State: addressData.address.addressRegion,
          County: county,
          City: addressData.address.addressLocality,
          Street: addressData.address.streetAddress,
          'Zip Code': addressData.address.postalCode,
        }
        await detail(addressData.url, detailObj, i + 1, page)
      }
    }
  }
  console.log('Complete Scrapping Page: ' + targetUrl)
  await paginationPage.close()
}

const detail = async (targetUrl, pObj, index = 0, page = 1) => {
  console.log(`scrapping ${page} >> ${index}.... ${targetUrl}`)
  var localObj = {}
  var detailPage = await browser.newPage()
  await detailPage.goto(targetUrl, {
    waitUntil: 'networkidle0',
    timeout: 0,
  })

  var price = await detailPage.evaluate(() => {
    const priceTag = document.querySelector(
      'div.summary-price-space > div > div>div.textIntent-title2'
    )
    return priceTag.textContent
  })
  pObj['Rental Price'] = price.replaceAll(',', '')

  var bed = await detailPage.evaluate(() => {
    const bedsTag = document.querySelector(
      'div[data-tn="listing-page-summary-beds"]>div>div.textIntent-title2'
    )
    const bedTag = document.querySelector(
      'div[data-tn="listing-page-summary-bed"]>div>div.textIntent-title2'
    )
    if (bedsTag) {
      return bedsTag.textContent
    } else if (bedTag) {
      return bedTag.textContent
    } else {
      return '-'
    }
  })
  pObj['Number of Bedrooms'] = bed

  var bath = await detailPage.evaluate(() => {
    const bathsTag = document.querySelector(
      'div[data-tn="listing-page-summary-baths"]>div>div.textIntent-title2'
    )
    const bathTag = document.querySelector(
      'div[data-tn="listing-page-summary-bath"]>div>div.textIntent-title2'
    )
    if (bathsTag) {
      return bathsTag.textContent
    } else if (bathTag) {
      return bathTag.textContent
    } else {
      return '-'
    }
  })
  pObj['Number of Bathrooms'] = bath

  var sqft = await detailPage.evaluate(() => {
    const sqftTag = document.querySelector(
      'div[data-tn="listing-page-summary-sq-ft"]>div>div.textIntent-title2'
    )
    return sqftTag.textContent
  })
  pObj['Square Feet'] = sqft.replaceAll(',', '').replaceAll('Sq. Ft.', '')

  const listingDetails = await detailPage.$$('tr.keyDetails-text')
  for (const property of listingDetails) {
    try {
      let key = await detailPage.evaluate(
        (el) => el.querySelector('th').textContent,
        property
      )
      let value = await detailPage.evaluate(
        (el) => el.querySelector('td').textContent,
        property
      )

      key = key
        .toString()
        .trim()
        .toLowerCase()
        .replaceAll(' ', '_')
        .replaceAll('/', '_')
      localObj[key] = value.trim()
    } catch (e) {}
  }
  pObj['County'] = localObj.county
  pObj['Year Built'] = localObj.year_built
  pObj['Building Type'] = localObj.mls_type

  const viewMoreBtn = await detailPage.$(
    'button[data-tn="listing-page-building-info-view-more"]'
  )
  if (viewMoreBtn) {
    await detailPage
      .locator('button[data-tn="listing-page-building-info-view-more"]')
      .filter((button) => button.textContent === 'View More')
      .click()
  }
  const buildingInfoDivs = await detailPage.$$(
    'div[data-tn="listing-page-building-info-building-info-wrapper"]>span'
  )
  localObj = {}
  for (const property of buildingInfoDivs) {
    try {
      let key = await detailPage.evaluate(
        (el) => el.querySelector('span').textContent,
        property
      )
      let value = await detailPage.evaluate(
        (el) => el.querySelector('strong').textContent,
        property
      )

      key = key
        .toString()
        .trim()
        .toLowerCase()
        .replaceAll(' ', '_')
        .replaceAll('/', '_')
      localObj[key] = value.trim()
    } catch (e) {}
  }

  const propertyInfoCategoryDivs = await detailPage.$$(
    'div[data-tn="uc-listing-propertyInformationCategory"]'
  )
  var rentalIncludes = []
  var interiors = []
  for (const propertyInfoCategoryDiv of propertyInfoCategoryDivs) {
    let title = await detailPage.evaluate(
      (el) =>
        el.querySelector(
          'div[data-tn="uc-listing-propertyInformationCategory-title"]'
        ).textContent,
      propertyInfoCategoryDiv
    )
    if (title.toLowerCase() == 'interior and exterior features') {
      interiors = await detailPage.evaluate((el) => {
        const liTags = Array.from(el.querySelectorAll('li'))
        return liTags.map((tag) => tag.textContent)
      }, propertyInfoCategoryDiv)
    }
    if (title.toLowerCase() == 'rental') {
      rentalIncludes = await detailPage.evaluate((el) => {
        const liTags = Array.from(el.querySelectorAll('li'))
        return liTags.map((tag) => tag.textContent)
      }, propertyInfoCategoryDiv)
    }
  }

  let heatIncl = null,
    hsInternetIncl = null,
    elecrticIncl = null,
    gasIncl = null,
    waterIncl = null,
    sewerIncl = null,
    trashPickupIncl = null,
    cabletvIncl = null,
    radiantIncl = null
  rentalIncludes.forEach((str) => {
    const lastColonIndex = str.lastIndexOf(':')
    const firstPart = str.substring(0, lastColonIndex).trim()
    const value = str.substring(lastColonIndex + 1).trim()
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('cabletv')) {
      cabletvIncl = value
    }
    if (
      firstPart.toLowerCase().replaceAll(' ', '').includes('trashcollection')
    ) {
      trashPickupIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('radiant')) {
      radiantIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('gas')) {
      gasIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('electric')) {
      elecrticIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('internet')) {
      hsInternetIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('heat')) {
      heatIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('water')) {
      waterIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('sewer')) {
      sewerIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('rentincludes')) {
      if (value.toLowerCase().replaceAll(' ', '').includes('cabletv')) {
        cabletvIncl = 'Yes'
      }
      if (value.toLowerCase().replaceAll(' ', '').includes('trashcollection')) {
        trashPickupIncl = 'Yes'
      }
      if (value.toLowerCase().replaceAll(' ', '').includes('radiant')) {
        radiantIncl = 'Yes'
      }
      if (value.toLowerCase().replaceAll(' ', '').includes('gas')) {
        gasIncl = 'Yes'
      }
      if (value.toLowerCase().replaceAll(' ', '').includes('electric')) {
        elecrticIncl = 'Yes'
      }
      if (value.toLowerCase().replaceAll(' ', '').includes('internet')) {
        hsInternetIncl = 'Yes'
      }
      if (value.toLowerCase().replaceAll(' ', '').includes('heat')) {
        heatIncl = 'Yes'
      }
      if (value.toLowerCase().replaceAll(' ', '').includes('water')) {
        waterIncl = 'Yes'
      }
      if (value.toLowerCase().replaceAll(' ', '').includes('sewer')) {
        sewerIncl = 'Yes'
      }
    }
  })

  pObj['High Speed Internet - Included with Rent'] = hsInternetIncl
  pObj['Electric - Included with Rent'] = elecrticIncl
  pObj['Gas - Included with Rent'] = gasIncl
  pObj['Water - Included with Rent'] = waterIncl
  pObj['Sewer - Included with Rent'] = sewerIncl
  pObj['Trash Pickup - Included with Rent'] = trashPickupIncl
  pObj['Cable Television - Included with Rent'] = cabletvIncl
  pObj['Radiant - Included with Rent'] = radiantIncl

  let refrigeratorIncl = null,
    washerIncl = null,
    dryerIncl = null,
    dishwasherIncl = null,
    microwaveIncl = null,
    patioIncl = null,
    heating = null,
    airConIncl = null,
    garageIncl = null,
    parkingIncl = null,
    poolIncl = null,
    appliancesIncl = null,
    interorFeatures = null

  interiors.forEach((str) => {
    const lastColonIndex = str.lastIndexOf(':')
    const firstPart = str.substring(0, lastColonIndex).trim()
    const value = str.substring(lastColonIndex + 1).trim()
    if (
      firstPart.toLowerCase().replaceAll(' ', '').includes('interiorfeatures')
    ) {
      interorFeatures = value.replaceAll(',', '/')
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('refrigerator')) {
      refrigeratorIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('washer')) {
      washerIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '') == 'heating') {
      heating = value.replaceAll(',', '/')
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('appliances')) {
      appliancesIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('dryer')) {
      dryerIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('dishwasher')) {
      dishwasherIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('microwave')) {
      microwaveIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('patio')) {
      patioIncl = value.replaceAll(',', '/')
    }
    if (
      firstPart.toLowerCase().replaceAll(' ', '').includes('airconditioner')
    ) {
      airConIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('garage')) {
      garageIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('parking')) {
      parkingIncl = value
    }
    if (firstPart.toLowerCase().replaceAll(' ', '').includes('pool')) {
      poolIncl = value
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

    if (firstPart.toLowerCase().replaceAll(' ', '').includes('amenities')) {
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
      if (value.toLowerCase().replaceAll(' ', '').includes('airconditioner')) {
        airConIncl = 'Yes'
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
    }
  })

  pObj['Heat - Included with Rent'] = heatIncl ?? heating ? 'Yes' : 'No'
  pObj['Heater'] = heating
  pObj['Refrigerator'] = refrigeratorIncl
  pObj['Washer'] = washerIncl
  pObj['Dryer'] = dryerIncl
  pObj['Dishwasher'] = dishwasherIncl
  pObj['Microwave'] = microwaveIncl
  pObj['Patio'] = patioIncl
  pObj['Air Conditioner'] = airConIncl
  pObj['Garage'] = garageIncl
  pObj['Parking'] = parkingIncl
  pObj['Pool'] = poolIncl
  pObj['Appliances included'] = appliancesIncl

  pObj['Stove Type'] = null
  pObj['Water Heater'] = null
  pObj['Cable Ready'] = null
  pObj['Ceiling Fan'] = null
  pObj['Garbage Disposal'] = null
  pObj['Miniblinds'] = null
  pObj['Back Porch'] = null
  pObj['Balcony'] = null
  pObj['Deck'] = null
  pObj['Fenced Backyard'] = null
  pObj['Fenced Front Yard'] = null
  pObj['Front Porch'] = null
  pObj['Pest Control'] = null
  pObj["32'' doors"] = null
  pObj['Flat entry'] = null
  pObj['Ramped entry'] = null

  pObj['Interior features'] = interorFeatures
  pObj['Fees Include'] = null
  pObj['Gated Community'] = null
  await detailPage.close()
  writeToFile(folderName, pObj)
}

const counties = ['jefferson', 'dutchess', 'oswego', 'oneida', 'ulster']

const scrap = async (county, index) => {
  if (index != 0) {
    folderName = replaceLastPart(folderName, county)
  } else {
    folderName += `/${county}`
  }
  rootUrl = `https://www.compass.com/for-rent/${county}-county-ny/status=coming-soon,active,rented/rented-date.max=1years/`
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
