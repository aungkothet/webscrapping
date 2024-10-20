import fs from 'fs'
import path from 'path'
import csvjson from 'csvjson'

const inputFolder =
  '/Users/kothet/FormaticX/webscrapping/jsons/2024-10-20--09-12' // Replace with the actual path to your folder
const outputFile = 'onekeymls-outout-2024-10-20.json'
const outputCSVFile = 'onekeymls-outout-2024-10-20.csv'
const results = []

var i = 0
// fs.readdir(inputFolder, (err, files) => {
//   if (err) throw err

//   files.forEach((file) => {
//     if (path.extname(file) === '.json') {
//       const filePath = path.join(inputFolder, file)

//       fs.readFile(filePath, 'utf8', (err, data) => {
//         if (err) throw err
//         const jsonData = JSON.parse(data)

//         jsonData.forEach((data) => {
//           results.push(data)
//         })
//         i++
//         if (files.length === i) {
//           // Write the merged data to a single JSON file
//           fs.writeFile(outputFile, JSON.stringify(results, null, 2), (err) => {
//             if (err) throw err
//             console.log('Merged data written to ' + outputFile)
//           })
//         }
//       })
//     }
//   })
// })

fs.readFile(outputFile, 'utf-8', (err, fileContent) => {
  if (err) {
    console.error(err)
    return
  }
  const csvData = csvjson.toCSV(fileContent, {
    headers: 'key',
  })
  fs.writeFile(outputCSVFile, csvData, 'utf-8', (err) => {
    if (err) {
      console.error(err)
      return
    }
    console.log('Conversion successful. CSV file created.')
  })
})
