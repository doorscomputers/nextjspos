import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth.simple"

const handler = NextAuth(authOptions)

export const GET = handler
export const POST = handler

// Required for Next.js 15 App Router
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
