import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth.simple"

// Route segment config for Vercel
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)

export const GET = handler
export const POST = handler
