import NextAuth from "next-auth"
import { authOptions } from "../../../src/lib/auth.simple"

// This is the Pages Router format that NextAuth v4 was designed for
// Vercel handles this correctly in serverless functions
export default NextAuth(authOptions)
