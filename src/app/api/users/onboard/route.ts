// src/app/api/users/onboard/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@clerk/nextjs/server'; // Import Clerk's server-side auth helper

export async function POST(req: NextRequest) {
    try {
        // 1. Get the authenticated user ID from Clerk
        const { userId } = await auth();
        if (!userId) {
            // Should be protected by middleware, but double-check
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 2. Parse the request body to get selected interest IDs
        const body = await req.json();
        const { interestIds } = body;

        // Basic validation
        if (!Array.isArray(interestIds) || interestIds.length === 0) {
            return new NextResponse("Bad Request: interestIds must be a non-empty array", { status: 400 });
        }

        // Check if user exists, create if not
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            // Create user if they don't exist
            await prisma.user.create({
                data: {
                    id: userId,
                    username: `user_${userId.slice(0, 8)}`, // Temporary username
                    email: "", // Will be updated later
                    onboarded: false
                }
            });
        }

        // 3. Use Prisma Transaction to perform multiple database operations atomically
        await prisma.$transaction(async (tx) => {
            // a) Create entries in the UserInterest join table
            //    Use skipDuplicates to avoid errors if an entry already exists (e.g., user re-submits)
            await tx.userInterest.createMany({
                data: interestIds.map((id: string) => ({
                    userId: userId,
                    interestId: id,
                })),
                skipDuplicates: true,
            });

            // b) Update the user's onboarded status in your User table
            //    We assume the user record *should* exist if they are authenticated.
            //    If this fails ("Record to update not found"), it indicates a potential sync issue
            //    between Clerk auth and your DB user table creation (addressable later, maybe via webhooks).
            await tx.user.update({
                where: { id: userId },
                data: { onboarded: true },
            });
        });

        // 4. Return a success response
        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error("Onboarding failed:", error);

        // Handle potential known errors, e.g., user not found during update
        if (error instanceof Error && error.message.includes("Record to update not found")) {
            return new NextResponse("User record not found in DB. Sync issue?", { status: 404 });
        }
        // Handle potential known errors, e.g., foreign key constraint if an interestId is invalid
        if (error instanceof Error && error.message.includes("Foreign key constraint failed")) {
            return new NextResponse("Bad Request: One or more interest IDs are invalid", { status: 400 });
        }


        // Generic internal server error for other cases
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}