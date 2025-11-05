/**
 * Test OpenAI API Key
 * This script tests if your OpenAI API key is valid and working
 */

import 'dotenv/config'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

async function testOpenAIKey() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 TESTING OPENAI API KEY')
  console.log('='.repeat(80))
  console.log('')

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY is not set in environment')
    console.log('')
    console.log('Please add it to your .env file:')
    console.log('OPENAI_API_KEY=sk-proj-your-actual-key-here')
    return
  }

  if (apiKey === 'your-openai-api-key-here') {
    console.log('❌ OPENAI_API_KEY is still set to placeholder value')
    console.log('')
    console.log('Please update your .env file with a real API key from:')
    console.log('https://platform.openai.com/api-keys')
    return
  }

  console.log('✅ OPENAI_API_KEY found in environment')
  console.log(`   Key starts with: ${apiKey.substring(0, 10)}...`)
  console.log('')
  console.log('🔄 Testing API connection...')
  console.log('')

  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: 'Say "Hello from POS System!" in exactly 5 words.',
      maxTokens: 50,
    })

    console.log('✅ SUCCESS! OpenAI API is working!')
    console.log('')
    console.log('Response from AI:')
    console.log(`   "${result.text}"`)
    console.log('')
    console.log('='.repeat(80))
    console.log('✅ YOUR OPENAI API KEY IS VALID AND WORKING!')
    console.log('='.repeat(80))
    console.log('')
    console.log('🎉 Your AI Assistant should work now!')
    console.log('   Visit: https://pcinet.shop/dashboard/ai-assistant')
    console.log('')

  } catch (error: any) {
    console.log('❌ FAILED! OpenAI API Error')
    console.log('')
    console.log('Error details:')
    console.log(`   ${error.message}`)
    console.log('')

    if (error.message?.includes('401') || error.message?.includes('Incorrect API key')) {
      console.log('🔍 Diagnosis: Invalid API Key')
      console.log('')
      console.log('Solutions:')
      console.log('  1. Go to: https://platform.openai.com/api-keys')
      console.log('  2. Create a new secret key')
      console.log('  3. Update your .env file with the new key')
      console.log('  4. Update Vercel environment variable')
    } else if (error.message?.includes('quota') || error.message?.includes('billing')) {
      console.log('🔍 Diagnosis: Billing/Quota Issue')
      console.log('')
      console.log('Solutions:')
      console.log('  1. Go to: https://platform.openai.com/account/billing')
      console.log('  2. Add payment method')
      console.log('  3. Add credits to your account')
    } else if (error.message?.includes('rate_limit')) {
      console.log('🔍 Diagnosis: Rate Limit Exceeded')
      console.log('')
      console.log('Solutions:')
      console.log('  1. Wait a few minutes')
      console.log('  2. Try again')
    } else {
      console.log('🔍 Diagnosis: Unknown Error')
      console.log('')
      console.log('Full error:')
      console.log(error)
    }

    console.log('')
    console.log('='.repeat(80))
  }
}

testOpenAIKey()
