const https = require('https')
const http = require('http')

async function testDashboardAPI() {
  try {
    // First login to get session
    console.log('Step 1: Logging in...')

    const loginData = JSON.stringify({
      username: 'admin',
      password: 'password'
    })

    const loginOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/callback/credentials',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    }

    // Get cookies from login
    const loginResponse = await new Promise((resolve, reject) => {
      const req = http.request(loginOptions, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          const cookies = res.headers['set-cookie']
          resolve({ statusCode: res.statusCode, cookies, data })
        })
      })
      req.on('error', reject)
      req.write(loginData)
      req.end()
    })

    console.log('Login status:', loginResponse.statusCode)

    if (!loginResponse.cookies) {
      console.error('No cookies received from login')
      return
    }

    // Now fetch dashboard stats with auth
    console.log('\nStep 2: Fetching dashboard stats...')

    const statsOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: {
        'Cookie': loginResponse.cookies.join('; ')
      }
    }

    const statsResponse = await new Promise((resolve, reject) => {
      const req = http.request(statsOptions, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => resolve({ statusCode: res.statusCode, data }))
      })
      req.on('error', reject)
      req.end()
    })

    console.log('Dashboard API status:', statsResponse.statusCode)

    const stats = JSON.parse(statsResponse.data)

    console.log('\n=== Stock Alerts from API ===')
    console.log('Count:', stats.tables.stockAlerts.length)
    console.log('\nStock Alerts:')
    console.log(JSON.stringify(stats.tables.stockAlerts, null, 2))

  } catch (error) {
    console.error('Error:', error.message)
  }
}

testDashboardAPI()
