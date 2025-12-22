'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

interface ConnectImapFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function ConnectImapForm({ onSuccess, onCancel }: ConnectImapFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        imapHost: '',
        imapPort: '993',
        smtpHost: '',
        smtpPort: '465',
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    // Pre-fill helpers for common providers
    const applyPreset = (provider: 'outlook' | 'yahoo') => {
        if (provider === 'outlook') {
            setFormData(prev => ({
                ...prev,
                imapHost: 'outlook.office365.com',
                imapPort: '993',
                smtpHost: 'smtp.office365.com',
                smtpPort: '587',
            }))
        } else if (provider === 'yahoo') {
            setFormData(prev => ({
                ...prev,
                imapHost: 'imap.mail.yahoo.com',
                imapPort: '993',
                smtpHost: 'smtp.mail.yahoo.com',
                smtpPort: '465',
            }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        try {
            const payload = {
                provider: 'imap',
                imapConfig: {
                    host: formData.imapHost,
                    port: parseInt(formData.imapPort),
                    secure: formData.imapPort === '993', // Simple heuristic
                    auth: {
                        user: formData.email,
                        pass: formData.password,
                    },
                },
                smtpConfig: {
                    host: formData.smtpHost,
                    port: parseInt(formData.smtpPort),
                    secure: formData.smtpPort === '465', // Simple heuristic
                    auth: {
                        user: formData.email,
                        pass: formData.password,
                    },
                },
            }

            const res = await fetch('/api/auth/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to connect account')
            }

            onSuccess()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full mt-2">
            <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('outlook')}>
                            Outlook / Hotmail
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('yahoo')}>
                            Yahoo
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({
                            email: '', password: '', imapHost: '', imapPort: '993', smtpHost: '', smtpPort: '465'
                        })}>
                            Custom / Other
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password (or App Password)</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="imapHost">IMAP Host</Label>
                            <Input
                                id="imapHost"
                                name="imapHost"
                                required
                                value={formData.imapHost}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="imapPort">IMAP Port</Label>
                            <Input
                                id="imapPort"
                                name="imapPort"
                                required
                                value={formData.imapPort}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpHost">SMTP Host</Label>
                            <Input
                                id="smtpHost"
                                name="smtpHost"
                                required
                                value={formData.smtpHost}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPort">SMTP Port</Label>
                            <Input
                                id="smtpPort"
                                name="smtpPort"
                                required
                                value={formData.smtpPort}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>
                <div className="flex justify-between mt-6">
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Connect
                    </Button>
                </div>
            </form>
        </div>
    )
}
