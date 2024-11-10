import fs from 'fs'
import csvjson from 'csvjson'

export function replaceLastPart(string, replacement) {
  const parts = string.split('/')
  parts[parts.length - 1] = replacement
  const newString = parts.join('/')
  return newString
}

export function closeJsonFile(folderName) {
  const fileName = folderName.replaceAll('/', '-')
  var jsonFileName = `output/jsons/${folderName}/${fileName}.json`
  let fileContent = fs.readFileSync(jsonFileName, 'utf-8')
  if (fileContent.endsWith(',\n')) {
    fileContent = fileContent.slice(0, -2)
    fs.writeFileSync(jsonFileName, fileContent + '\n]')
  } else {
    let a = fileContent.slice(0, -2)
    if (a.length == 0) {
      fs.writeFileSync(jsonFileName, fileContent + ']')
    }
  }
}

export function checkAlreadyScrapped(id, site) {
  const fileName = `finished/${site}-ids.json`
  if (!fs.existsSync('finished')) {
    fs.mkdirSync('finished', { recursive: true }, (err) => {})
  }
  if (!fs.existsSync(fileName)) {
    fs.writeFileSync(fileName, '[]')
  }
  let fileContent = fs.readFileSync(fileName, 'utf-8')
  let ary = JSON.parse(fileContent)
  if (ary.includes(id)) {
    return true
  } else {
    ary.push(id)
    fs.writeFileSync(fileName, JSON.stringify(ary))
    return false
  }
}

export function writeToFile(folderName, obj = null, start = false) {
  const fileName = folderName.replaceAll('/', '-')
  var jsonFileName = `output/jsons/${folderName}/${fileName}.json`
  const jsonDirectory = `output/jsons/${folderName}`
  var message
  try {
    if (!fs.existsSync(jsonDirectory)) {
      fs.mkdirSync(jsonDirectory, { recursive: true }, (err) => {})
    }
  } catch (err) {
    console.error(err)
  }
  if (obj) {
    message = JSON.stringify(obj) + ','
  }
  if (start) {
    message = '['
  }
  const jsonFile = fs.createWriteStream(jsonFileName, { flags: 'a' })
  jsonFile.write(message + '\n', 'utf8')
}

export function generateExport(folderName) {
  const fileName = folderName.replaceAll('/', '-')
  const exportDir = `output/export/${folderName}`
  var jsonFileName = `output/jsons/${folderName}/${fileName}.json`
  const csvFileName = `${exportDir}/${fileName}.csv`
  try {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true }, (err) => {})
    }
  } catch (err) {
    console.error(err)
  }
  fs.readFile(jsonFileName, 'utf-8', (err, fileContent) => {
    if (err) {
      console.error(err)
      return
    }
    if (fileContent.length > 3) {
      const csvData = csvjson.toCSV(fileContent, { headers: 'key' })
      fs.writeFile(csvFileName, csvData, 'utf-8', (err) => {
        if (err) {
          console.error(err)
          return
        }
        console.log(`Final CSV file created at : ${csvFileName}`)
      })
    } else {
      console.log(`Skipped for Empty CSV Data`)
    }
  })
}

export function writeToLog(fileName, message) {
  const logDir = `output/logs/${fileName}`
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true }, (err) => {})
    }
  } catch (err) {
    console.error(err)
  }
  const logFileName = `${logDir}/${fileName.replaceAll('/', '-')}.log`
  const logFile = fs.createWriteStream(logFileName, { flags: 'a' })
  logFile.write(message + '\n')
}
