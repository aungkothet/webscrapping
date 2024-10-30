import fs from 'fs'
import csvjson from 'csvjson'
import path from 'path'

export function replaceLastPart(string, replacement) {
  const parts = string.split('/')
  parts[parts.length - 1] = replacement
  const newString = parts.join('/')
  return newString
}

export function writeToFile(name, folderName, obj) {
  var jsonDirectory = path.join(path.resolve(), 'output/jsons/' + folderName)
  try {
    if (!fs.existsSync(jsonDirectory)) {
      fs.mkdirSync(jsonDirectory, { recursive: true }, (err) => {})
    }
  } catch (err) {
    console.error(err)
  }

  var json = JSON.stringify(obj)
  fs.writeFile(
    jsonDirectory + '/' + name + '.json',
    json,
    'utf8',
    function (err) {
      if (err) throw err
      console.log('writing to csv file')
      writeToCSV(name, folderName)
    }
  )
}

export function writeToCSV(name, folderName) {
  var csvDirectory = path.join(path.resolve(), 'output/csvs/' + folderName)
  var jsonDirectory = path.join(path.resolve(), 'output/jsons/' + folderName)
  try {
    if (!fs.existsSync(csvDirectory)) {
      fs.mkdirSync(csvDirectory, { recursive: true }, (err) => {})
    }
  } catch (err) {
    console.error(err)
  }
  fs.readFile(`${jsonDirectory}/${name}.json`, 'utf-8', (err, fileContent) => {
    if (err) {
      console.error(err)
      return
    }
    const csvData = csvjson.toCSV(fileContent, { headers: 'key' })
    fs.writeFile(`${csvDirectory}/${name}.csv`, csvData, 'utf-8', (err) => {
      if (err) {
        console.error(err)
        return
      }
      console.log('Conversion successful. CSV file created.')
    })
  })
}

export function generateExport(fileName) {
  var folderName = `output/jsons/${fileName}`
  const csvFileName = `output/export/${fileName.replaceAll('/', '-')}.csv`
  var results = []
  let i = 0

  fs.readdir(folderName, (err, files) => {
    if (err) throw err

    files.forEach((file) => {
      if (path.extname(file) === '.json') {
        const filePath = path.join(folderName, file)
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) throw err
          const jsonData = JSON.parse(data)
          jsonData.forEach((data) => {
            results.push(data)
          })
          i++
          if (files.length === i) {
            try {
              if (!fs.existsSync('output/export')) {
                fs.mkdirSync('output/export', { recursive: true }, (err) => {})
              }
            } catch (err) {
              console.error(err)
            }
            const csvData = csvjson.toCSV(results, {
              headers: 'key',
            })
            fs.writeFile(csvFileName, csvData, 'utf-8', (err) => {
              if (err) {
                console.error(err)
                return
              }
              console.log(`Final CSV file created at : ${csvFileName}`)
            })
          }
        })
      }
    })
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
