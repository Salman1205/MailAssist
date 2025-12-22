import { NextRequest, NextResponse } from 'next/server';
import { getAccountInfo } from '@/lib/account-type-utils';

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const accountInfo = await getAccountInfo(email);

        return NextResponse.json({
            exists: accountInfo.exists,
            hasPassword: accountInfo.hasPassword,
            accountType: accountInfo.accountType, // 'business' | 'personal' | null
            isVerified: accountInfo.isVerified,
            role: accountInfo.role,
        });

    } catch (error) {
        console.error('Check email error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

