import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { startHistoryWatch, stopHistoryWatch } from '@/lib/gmail';

/**
 * Gmail History watch management
 *
 * POST /api/emails/watch   -> start watch
 * DELETE /api/emails/watch -> stop watch
 *
 * NOTE: To actually receive notifications, you must configure a Google
 * Pub/Sub topic, grant Gmail publish permission, and point that topic
 * to a push subscription that calls your webhook endpoint. This code
 * only handles the Gmail-side watch setup/teardown.
 */

export async function POST() {
  try {
    const tokens = await getValidTokens();

    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    const watchInfo = await startHistoryWatch(tokens);

    return NextResponse.json({
      success: true,
      watchInfo,
    });
  } catch (error) {
    console.error('Error starting Gmail history watch:', error);
    return NextResponse.json(
      {
        error: 'Failed to start Gmail history watch',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tokens = await getValidTokens();

    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    await stopHistoryWatch(tokens);

    return NextResponse.json({
      success: true,
      message: 'Gmail history watch stopped',
    });
  } catch (error) {
    console.error('Error stopping Gmail history watch:', error);
    return NextResponse.json(
      {
        error: 'Failed to stop Gmail history watch',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


