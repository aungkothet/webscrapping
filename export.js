import fs from 'fs'
import path from 'path'
import csvjson from 'csvjson'

// var fileName = 'compass/2024-10-28/jefferson'
var fileName = process.argv[2]
var folderName = 'output/jsons/' + fileName
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
          fs.writeFile(
            'output/export/' + fileName.replaceAll('/', '-') + '.csv',
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
      })
    }
  })
})
