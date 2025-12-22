import { NextRequest, NextResponse } from 'next/server';
import { validateBusinessSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        // Check for business session
        const businessSession = await validateBusinessSession();

        if (!businessSession) {
            return NextResponse.json(
                { error: 'Not authenticated as a business' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        if (!supabase) {
            return NextResponse.json(
                { error: 'Database connection failed' },
                { status: 500 }
            );
        }

        // Delete tokens for this specific email AND business
        const { error } = await supabase
            .from('tokens')
            .delete()
            .eq('business_id', businessSession.businessId)
            .eq('user_email', email);

        if (error) {
            console.error('Error disconnecting account:', error);
            return NextResponse.json(
                { error: 'Failed to disconnect account' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error in disconnect route:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
