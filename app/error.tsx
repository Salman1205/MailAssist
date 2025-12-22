'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('App Error:', error)
    }, [error])

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-bold">Something went wrong!</h2>
            <p className="text-muted-foreground max-w-md text-center">
                {error.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-2">
                <Button onClick={() => window.location.href = '/'}>
                    Go Home
                </Button>
                <Button variant="outline" onClick={() => reset()}>
                    Try again
                </Button>
            </div>
        </div>
    )
}
