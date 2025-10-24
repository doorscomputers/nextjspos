import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetPassword() {
  try {
    const username = 'EricsonChanTransferReceiverTugue'
    const newPassword = 'password123'

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    const user = await prisma.user.update({
      where: { username },
      data: { password: hashedPassword }
    })

    console.log('✅ Password reset successfully!')
    console.log('Username:', username)
    console.log('New Password:', newPassword)
    console.log('\nYou can now login with these credentials.')

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

resetPassword()
