import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { Kanban, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatCurrency, DEAL_STAGES } from '../lib/utils'
import type { DealStage } from '../lib/utils'
import EmptyState from '../components/EmptyState'
import { createNotification } from '../hooks/useNotifications'
import { useEscapeKey } from '../hooks/useEscapeKey'

type Deal = {
  id: string; user_id: string; contact_name: string; value: number | null;
  stage: DealStage; assigned_to: string | null; created_at: string
}

type DealFormState = { contactName: string; value: string; assignedTo: string }

const stages = DEAL_STAGES
const stageBorder: Record<DealStage, string> = {
  Lead: '#3B82F6', Qualified: '#FACC15', Proposal: '#7C3AED',
  Negotiation: '#F97316', 'Closed Won': '#22C55E', 'Closed Lost': '#EF4444',
}
const initialForm: DealFormState = { contactName: '', value: '', assignedTo: '' }



function daysInStage(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))
}

function winProbability(deal: Deal, allDeals: Deal[]): number {
  const stageWeights: Record<DealStage, number> = {
    Lead: 10, Qualified: 25, Proposal: 50, Negotiation: 70, 'Closed Won': 100, 'Closed Lost': 0,
  }
  let score = stageWeights[deal.stage]
  // Bonus if value above average
  const avgValue = allDeals.reduce((s, d) => s + Number(d.value ?? 0), 0) / Math.max(allDeals.length, 1)
  if (Number(deal.value ?? 0) > avgValue) score = Math.min(score + 8, 100)
  // Penalty for long time in pipeline
  const days = daysInStage(deal.created_at)
  if (days > 30) score = Math.max(score - 10, 0)
  else if (days > 14) score = Math.max(score - 5, 0)
  return Math.round(score)
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedStage, setSelectedStage] = useState<DealStage>('Lead')
  const [form, setForm] = useState<DealFormState>(initialForm)
  // Deal detail panel
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  // Mobile stage selector
  const [mobileStage, setMobileStage] = useState<DealStage>('Lead')

  useEffect(() => { document.title = 'Pipeline — Atomise CRM' }, [])

  const dealsByStage = useMemo(
    () => stages.reduce((acc, stage) => { acc[stage] = deals.filter((d) => d.stage === stage); return acc }, {} as Record<DealStage, Deal[]>),
    [deals],
  )

  const fetchDeals = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals')
      .select('id, user_id, contact_name, value, stage, assigned_to, created_at')
      .limit(200)
    if (error) { toast.error(error.message); setLoading(false); return }
    setDeals((data ?? []) as Deal[])
    setLoading(false)
  }

  useEffect(() => { void fetchDeals() }, [])

  // Keep a ref for drag rollback to avoid stale closures
  const dealsRef = useRef(deals)
  useEffect(() => { dealsRef.current = deals }, [deals])

  const openModal = (stage: DealStage) => { setSelectedStage(stage); setForm(initialForm); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setForm(initialForm) }
  useEscapeKey(closeModal, modalOpen)

  const handleCreateDeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) { toast.error('Unable to find logged in user.'); setSaving(false); return }

    const payload = {
      user_id: userData.user.id,
      contact_name: form.contactName.trim(),
      value: Number(form.value || 0),
      assigned_to: form.assignedTo.trim(),
      stage: selectedStage,
    }

    const { error } = await supabase.from('deals').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Deal created!')
    closeModal()
    void fetchDeals()
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const destStage = destination.droppableId as DealStage
    const prevDeals = dealsRef.current
    const movingDeal = deals.find((d) => d.id === draggableId)
    if (!movingDeal) return

    setDeals((prev) => prev.map((d) => (d.id === draggableId ? { ...d, stage: destStage } : d)))

    const { error } = await supabase.from('deals').update({ stage: destStage }).eq('id', draggableId)
    if (error) { setDeals(prevDeals); toast.error(error.message); return }

    toast.success(`Moved to ${destStage}`)
    void createNotification('stage_change', `Deal "${movingDeal.contact_name}" moved to ${destStage}`)

    // Fetch contact details for webhook
    let contactId = 'Unknown'
    let contactEmail = 'Unknown'
    try {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, email')
        .ilike('name', `%${movingDeal.contact_name}%`)
        .limit(1)
        .single()
        
      if (contactData) {
        contactId = contactData.id
        contactEmail = contactData.email || 'Unknown'
      }
    } catch {
      // Ignore if not found
    }

    const webhookUrl = import.meta.env.VITE_N8N_STAGE_CHANGE_WEBHOOK
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deal_id: movingDeal.id,
            deal_title: movingDeal.contact_name,
            contact_id: contactId,
            contact_name: movingDeal.contact_name,
            contact_email: contactEmail,
            old_stage: movingDeal.stage,
            new_stage: destStage,
            deal_value: movingDeal.value,
          }),
        })
      } catch (err) {
        console.error('Failed to trigger n8n stage change webhook:', err)
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button type="button" onClick={() => openModal('Lead')} className="btn-primary">
          <Plus size={16} /> Add Deal
        </button>
      </div>

      {!loading && deals.length === 0 && (
        <EmptyState icon={Kanban} title="Your pipeline is empty" description="Create a deal and drag cards between stages as they progress." action={{ label: '+ Add Deal', onClick: () => openModal('Lead') }} />
      )}

      {/* Desktop Kanban */}
      <div className="hidden overflow-x-auto pb-2 md:block">
        <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
          <div className="flex min-w-max gap-3">
            {stages.map((stage) => {
              const stageDeals = dealsByStage[stage] ?? []
              const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0)
              return (
                <Droppable droppableId={stage} key={stage}>
                  {(dropProvided) => (
                    <section
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className="flex w-[220px] flex-col rounded-xl p-3"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', minHeight: 500 }}
                    >
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between">
                          <h2 className="text-sm font-bold">{stage}</h2>
                          <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                            {stageDeals.length}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatCurrency(totalValue)}</p>
                      </div>

                      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                        {loading ? (
                          Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)
                        ) : (
                          stageDeals.map((deal, index) => (
                            <Draggable draggableId={deal.id} index={index} key={deal.id}>
                              {(dragProvided) => (
                                <article
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => setSelectedDeal(deal)}
                                  className="cursor-pointer rounded-lg p-3 transition-transform duration-200 hover:scale-[1.02]"
                                  style={{
                                    ...dragProvided.draggableProps.style,
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--bg-border)',
                                    borderLeft: `3px solid ${stageBorder[deal.stage]}`,
                                  }}
                                >
                                  <p className="text-sm font-semibold">{deal.contact_name}</p>
                                  <p className="mt-1 text-sm font-medium" style={{ color: 'var(--success)' }}>
                                    {formatCurrency(Number(deal.value ?? 0))}
                                  </p>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{deal.assigned_to || 'Unassigned'}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                                      >
                                        {winProbability(deal, deals)}%
                                      </span>
                                      <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                                        {daysInStage(deal.created_at)}d
                                      </span>
                                    </div>
                                  </div>
                                </article>
                              )}
                            </Draggable>
                          ))
                        )}
                        {dropProvided.placeholder}
                      </div>

                      <button type="button" onClick={() => openModal(stage)} className="btn-secondary mt-3 w-full justify-center text-sm">
                        + Add Deal
                      </button>
                    </section>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Mobile: single-stage view */}
      <div className="md:hidden">
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {stages.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setMobileStage(s)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition"
              style={
                mobileStage === s
                  ? { background: 'var(--brand-glow)', color: 'var(--brand-secondary)', border: '1px solid rgba(124,58,237,0.3)' }
                  : { background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid transparent' }
              }
            >
              {s} ({(dealsByStage[s] ?? []).length})
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {(dealsByStage[mobileStage] ?? []).map((deal) => (
            <article
              key={deal.id}
              onClick={() => setSelectedDeal(deal)}
              className="cursor-pointer rounded-lg p-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderLeft: `3px solid ${stageBorder[deal.stage]}` }}
            >
              <p className="text-sm font-semibold">{deal.contact_name}</p>
              <p className="text-sm" style={{ color: 'var(--success)' }}>{formatCurrency(Number(deal.value ?? 0))}</p>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{deal.assigned_to || 'Unassigned'}</span>
            </article>
          ))}
          {(dealsByStage[mobileStage] ?? []).length === 0 && (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No deals in this stage</p>
          )}
        </div>
      </div>

      {/* Deal Detail Slide-over */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 bg-black/40" onKeyDown={(e) => { if (e.key === 'Escape') setSelectedDeal(null) }}>
          <div
            className="animate-slide-in-right ml-auto h-full w-full max-w-[420px] overflow-y-auto p-6"
            style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--bg-border)' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Deal Detail</h2>
              <button type="button" onClick={() => setSelectedDeal(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Contact</label>
                <p className="text-base font-semibold">{selectedDeal.contact_name}</p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Value</label>
                <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{formatCurrency(Number(selectedDeal.value ?? 0))}</p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Stage</label>
                <p className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: stageBorder[selectedDeal.stage] }} />
                  {selectedDeal.stage}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Assigned To</label>
                <p className="text-sm">{selectedDeal.assigned_to || 'Unassigned'}</p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Win Probability</label>
                <p className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                    {winProbability(selectedDeal, deals)}%
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>estimated</span>
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Days in Pipeline</label>
                <p className="text-sm">{daysInStage(selectedDeal.created_at)} days</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onKeyDown={(e) => { if (e.key === 'Escape') closeModal() }}>
          <div className="w-full max-w-md rounded-xl p-5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Deal — {selectedStage}</h2>
              <button type="button" onClick={closeModal} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateDeal} className="space-y-4">
              <div>
                <label htmlFor="contactName" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Contact Name</label>
                <input id="contactName" required value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} className="form-input" />
              </div>
              <div>
                <label htmlFor="dealValue" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Deal Value (USD)</label>
                <input id="dealValue" type="number" min="0" step="1" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} className="form-input" />
              </div>
              <div>
                <label htmlFor="assignedTo" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Assigned To</label>
                <input id="assignedTo" value={form.assignedTo} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))} className="form-input" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Creating...' : 'Create Deal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
