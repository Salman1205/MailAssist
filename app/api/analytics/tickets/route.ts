/**
 * GET /api/analytics/tickets - Get ticket analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTicketAnalytics } from '@/lib/analytics';
import { getSessionUserEmailFromRequest } from '@/lib/session';
import { validatePagination, isValidDate } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const userEmail = getSessionUserEmailFromRequest(request as any);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const startDateStr = url.searchParams.get('startDate') || '';
    const endDateStr = url.searchParams.get('endDate') || '';

    // Default to last 30 days if not provided
    const endDate = endDateStr && isValidDate(endDateStr)
      ? new Date(endDateStr)
      : new Date();
    const startDate = startDateStr && isValidDate(startDateStr)
      ? new Date(startDateStr)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const analytics = await getTicketAnalytics(userEmail, startDate, endDate);

    return NextResponse.json({
      analytics,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching ticket analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket analytics', details: (error as Error).message },
      { status: 500 }
    );
  }
}




