'use strict';
//aqui você pode usar normal as bibliotecas padrão do node
const { get } = require('axios')

class Handler {
  constructor({ rekoSvc, translatorSvc }) {
    this.rekoSvc = rekoSvc
    this.translatorSvc = translatorSvc
  }

  async getImageBuffer(imgUrl) {
    const response = await get(imgUrl, {
      responseType: 'arraybuffer'
    })
    const buffer = Buffer.from(response.data, 'base64')
    return buffer
  }
  async formatTextResults(texts, workingItems) {
    const finalText = []
    for (const indexText in texts) {
      const nameInPortuguese = texts[indexText]
      const confidence = workingItems[indexText].Confidence
      finalText.push(
        `${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`
      )
    }

    return finalText.join('\n')
  }
  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }

    const { TranslatedText } = await this.translatorSvc
      .translateText(params)
      .promise()

    return TranslatedText.split(' e ')
  }
  async detectImageLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise()
    const workingItems = result.Labels
      .filter(({ Confidence }) => Confidence > 80)

    const names = workingItems
      .map(({ Name }) => Name)
      .join(' and ')

    return { names, workingItems }
  }
  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters
      console.log('Downloading img ....')
      const imgBuffer = await this.getImageBuffer(imageUrl)
      console.log('Dectecting labels ...')
      const { names, workingItems } = await this.detectImageLabels(imgBuffer)
      console.log('Translating to Portuguese ...')
      const texts = await this.translateText(names)
      console.log('handling final object ....')
      const finalText = await this.formatTextResults(texts, workingItems)
      console.log('finishing')
      return {
        statusCode: 200,
        body: 'A imagem tem \n'.concat(finalText)
      }
    } catch (error) {
      console.log('Error**', error.stack)
      return {
        statusCode: 500,
        body: 'Internal Server Error'
      }
    }
  }
}

// Aqui vai virar um injeção de dependência
const aws = require("aws-sdk")
const reko = new aws.Rekognition()
const translator = new aws.Translate()
const handler = new Handler({
  rekoSvc: reko,
  translatorSvc: translator
})
module.exports.main = handler.main.bind(handler)