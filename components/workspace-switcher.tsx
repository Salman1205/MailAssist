import { useState, useEffect } from 'react'
import { getBusinessesForUser } from '@/lib/business-utils'

interface WorkspaceSwitcherProps {
  userEmail: string
  onSwitch: (businessId: string) => void
  currentBusinessId: string
}

export default function WorkspaceSwitcher({ userEmail, onSwitch, currentBusinessId }: WorkspaceSwitcherProps) {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBusinesses() {
      setLoading(true)
      const data = await getBusinessesForUser(userEmail)
      setBusinesses(data || [])
      setLoading(false)
    }
    fetchBusinesses()
  }, [userEmail])

  if (loading) return <div>Loading workspaces...</div>
  if (businesses.length <= 1) return null

  return (
    <div className="workspace-switcher">
      <label className="text-xs font-semibold mb-1 block">Workspace</label>
      <select
        value={currentBusinessId}
        onChange={e => onSwitch(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      >
        {businesses.map(biz => (
          <option key={biz.business_id} value={biz.business_id}>
            {biz.business.business_name || biz.business.business_email}
          </option>
        ))}
      </select>
    </div>
  )
}
