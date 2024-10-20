import puppeteer from 'puppeteer'
import { replaceLastPart, writeToFile } from './helper.js'

const baseUrl = 'https://www.onekeymls.com'
const rootUrl = 'https://www.onekeymls.com/homes/for-rent'

var targetUrl = rootUrl
var browser
var page
var obj = []
var link

var folderName = new Date()
  .toISOString()
  .slice(0, 16)
  .replaceAll(':', '-')
  .replaceAll('T', '--')

const init = async () => {
  console.log('Folder Name:' + folderName)
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: './tmp',
  })
  page = await browser.newPage()
  await page.goto(rootUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 0,
  })
  const paginationLinks = await page.$$(
    '.flex.flex-row.justify-center.items-center.gap-2 > a:last-child'
  )
  try {
    link = await page.evaluate(
      (el) => el.getAttribute('href'),
      paginationLinks[0]
    )
  } catch (e) {
    console.log(e)
  }
  let length = Number(link.split('/').pop())
  console.log('Total Pagination Page : ', length)

  await browser.close()
  for (var i = 1; i <= length; i++) {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      userDataDir: './tmp',
    })
    targetUrl = baseUrl + replaceLastPart(link, i)
    await getData(targetUrl)
    obj = []
    await browser.close()
  }
}

const getData = async (targetUrl) => {
  var paginationPage = await browser.newPage()
  await paginationPage.goto(targetUrl, {
    waitUntil: 'networkidle0',
    timeout: 0,
  })
  const propertySearchCards = await paginationPage.$$('.property-search-card')
  console.log('Scrapping Page: ', targetUrl)
  console.log('Total Property in this page: ', propertySearchCards.length)
  for (const propertyCard of propertySearchCards) {
    try {
      let link = await paginationPage.evaluate(
        (el) => el.querySelector('a').getAttribute('href'),
        propertyCard
      )
      var url = baseUrl + link
    } catch (e) {}

    try {
      var price = await paginationPage.evaluate(
        (el) => el.querySelector('div.font-semibold.text-black-soft').innerText,
        propertyCard
      )
      price = price.replaceAll(',', '')
    } catch (e) {}

    try {
      let rooms = await paginationPage.evaluate((el) => {
        const roomsTags = Array.from(
          el.querySelectorAll('div.flex.items-baseline > span.font-semibold')
        )
        return roomsTags.map((room) => room.innerText)
      }, propertyCard)

      let [lbed, lsqf, lacres] = rooms
      var bed = lbed
      var sqf = lsqf.replaceAll(',', '')

      var bath = await paginationPage.evaluate(
        (el) =>
          el.querySelector(
            'div.flex.items-baseline > span > span.font-semibold'
          ).innerText,
        propertyCard
      )
    } catch (e) {}

    try {
      buildingType = await paginationPage.evaluate(
        (el) =>
          el.querySelector(
            'div.flex.gap-x-5 > div.leading-tight.text-sm.font-medium'
          ).innerText,
        propertyCard
      )
    } catch (e) {}

    let detailObj = {
      Url: url,
      'Number of Bedrooms': bed,
      'Number of Bathrooms': bath,
      'Square Feet': sqf,
      'Rental Price': price,
    }
    await detail(url, detailObj)
  }
  writeToFile(
    targetUrl.replaceAll('/', '_').replaceAll('.', '_').replaceAll(':', '_'),
    folderName,
    obj
  )
  console.log('Complete Scrapping Page: ' + targetUrl)
  await paginationPage.close()
}

const detail = async (targetUrl, pObj) => {
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: './tmp',
  })
  console.log('scrapping .... ' + targetUrl)
  var localObj = {}
  var detailPage = await browser.newPage()
  await detailPage.goto(targetUrl, {
    waitUntil: 'networkidle0',
    timeout: 0,
  })

  const addressDiv = await detailPage.$$(
    'div.flex.text-membio-dark-100.text-xs.p-2 > a'
  )
  let addressAry = []
  for (const ahref of addressDiv) {
    let aValue = await detailPage.evaluate((el) => el.innerText, ahref)
    addressAry.push(aValue)
  }
  var state = addressAry[0]
  var county = addressAry[1]
  var city = addressAry[2]
  var zipcode = addressAry[3]
  var street = addressAry[4]

  const propertyDivs = await detailPage.$$(
    'div.grid.grid-cols-2.border-b.p-2.place-content-center'
  )
  for (const property of propertyDivs) {
    try {
      let key = await detailPage.evaluate(
        (el) => el.querySelector('div.text-sm.self-center').innerText,
        property
      )
      let value = await detailPage.evaluate(
        (el) => el.lastChild.innerText,
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

  let appliances_included =
    localObj.appliances_included != undefined
      ? localObj.appliances_included.replaceAll(',', '/')
      : '-'
  let interior_features =
    localObj.interior_features != undefined
      ? localObj.interior_features.replaceAll(',', '/')
      : '-'
  let fees_include =
    localObj.fees_include != undefined
      ? localObj.fees_include.replaceAll(',', '/')
      : '-'
  let heating =
    localObj.heating != undefined ? localObj.heating.replaceAll(',', '/') : '-'

  pObj['State'] = state
  pObj['County'] = county
  pObj['City'] = city
  pObj['Street'] = street
  pObj['Zip Code'] = zipcode

  pObj['Building Type'] = localObj.property_type
  pObj['Year Built'] = localObj.year_built
  pObj['Heater'] = heating
  pObj['Heat - Included with Rent'] = heating !== '-' ? 'Yes' : 'No'
  pObj['Air Conditioner'] = localObj.cooling
  pObj['Garage'] = localObj.garage
  pObj['Parking'] = localObj.parking_spots
  pObj['Pool'] = localObj.pool
  pObj['Interior features'] = interior_features
  pObj['Appliances included'] = appliances_included
  pObj['Fees Include'] = fees_include

  pObj['Gated Community'] = localObj.community_features
  pObj['Refrigerator'] = appliances_included
    .toLowerCase()
    .includes('refrigerator')
    ? 'Yes'
    : 'No'
  pObj['Washer'] = appliances_included.toLowerCase().includes('washer')
    ? 'Yes'
    : 'No'
  pObj['Dryer'] = appliances_included.toLowerCase().includes('dryer')
    ? 'Yes'
    : 'No'
  pObj['Dishwasher'] = appliances_included.toLowerCase().includes('dishwasher')
    ? 'Yes'
    : 'No'
  pObj['Microwave'] = appliances_included.toLowerCase().includes('microwave')
    ? 'Yes'
    : 'No'
  pObj['High Speed Internet - Included with Rent'] = interior_features
    .toLowerCase()
    .includes('high speed internet')
    ? 'Yes'
    : 'No'
  pObj['Electric - Included with Rent'] = null
  pObj['Gas - Included with Rent'] = null
  pObj['Water - Included with Rent'] = null
  pObj['Sewer - Included with Rent'] = null
  pObj['Trash Pickup - Included with Rent'] = null

  pObj['Cable Television - Included with Rent'] = null
  pObj['Radiant - Included with Rent'] = null
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
  pObj['Patio'] = null
  pObj['Pest Control'] = null
  pObj["32'' doors"] = null
  pObj['Flat entry'] = null
  pObj['Ramped entry'] = null

  obj.push(pObj)
  await detailPage.close()

  writeToFile('test', 'test', obj)
}

detail(
  'https://www.onekeymls.com/address/613-New-Jersey-Avenue-1FL-East-New-York-NY-11207/3585424',
  {}
)
