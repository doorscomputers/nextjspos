/**
 * Cleanup Orphaned User Location Assignments
 *
 * This script removes location assignments that point to deleted users or locations.
 *
 * Usage: npx tsx scripts/cleanup-orphaned-locations.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupOrphanedAssignments() {
  console.log('🧹 Starting cleanup of orphaned user location assignments...\n')

  try {
    // Find orphaned assignments
    const orphanedAssignments = await prisma.userLocation.findMany({
      where: {
        OR: [
          { user: { deletedAt: { not: null } } },
          { location: { deletedAt: { not: null } } }
        ]
      },
      include: {
        user: { select: { id: true, username: true, deletedAt: true } },
        location: { select: { id: true, name: true, deletedAt: true } }
      }
    })

    if (orphanedAssignments.length === 0) {
      console.log('✅ No orphaned assignments found. Database is clean!')
      return
    }

    console.log(`Found ${orphanedAssignments.length} orphaned assignment(s):\n`)

    orphanedAssignments.forEach((assignment, index) => {
      console.log(`${index + 1}. UserLocation record:`)
      console.log(`   User: #${assignment.userId} (${assignment.user.username})`)
      console.log(`   User Deleted: ${assignment.user.deletedAt ? 'YES ⚠️' : 'NO'}`)
      console.log(`   Location: #${assignment.locationId} (${assignment.location.name})`)
      console.log(`   Location Deleted: ${assignment.location.deletedAt ? 'YES ⚠️' : 'NO'}`)
      console.log()
    })

    // Delete orphaned assignments
    console.log('Deleting orphaned assignments...')

    const result = await prisma.userLocation.deleteMany({
      where: {
        OR: [
          { user: { deletedAt: { not: null } } },
          { location: { deletedAt: { not: null } } }
        ]
      }
    })

    console.log(`✅ Deleted ${result.count} orphaned assignment(s)`)
    console.log('✅ Cleanup completed successfully!')

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run cleanup
cleanupOrphanedAssignments()
