import fs from 'fs'
import csvjson from 'csvjson'
import path from 'path'

var jsonDirectory
var csvDirectory

export function replaceLastPart(string, replacement) {
  const parts = string.split('/')
  parts[parts.length - 1] = replacement
  const newString = parts.join('/')
  return newString
}

export function writeToFile(name, folderName, obj) {
  jsonDirectory = path.join(path.resolve(), 'jsons/' + folderName)
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
  csvDirectory = path.join(path.resolve(), 'csvs/' + folderName)
  try {
    if (!fs.existsSync(csvDirectory)) {
      fs.mkdirSync(csvDirectory, { recursive: true }, (err) => {})
    }
  } catch (err) {
    console.error(err)
  }
  fs.readFile(
    jsonDirectory + '/' + name + '.json',
    'utf-8',
    (err, fileContent) => {
      if (err) {
        console.error(err)
        return
      }
      const csvData = csvjson.toCSV(fileContent, {
        headers: 'key',
      })
      fs.writeFile(
        csvDirectory + '/' + name + '.csv',
        csvData,
        'utf-8',
        (err) => {
          if (err) {
            console.error(err)
            return
          }
          console.log('Conversion successful. CSV file created.')
        }
      )
    }
  )
}
