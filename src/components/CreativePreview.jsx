import React from 'react'
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Star, Inbox, Lock } from 'lucide-react'

// Realistic, illustrative mockups of how each variant renders in its channel.
// Purely presentational — no real Capital One creative, clearly labelled as a preview.

const FALLBACK = {
  headline: 'Your headline appears here',
  primaryText: 'Your supporting copy appears here, front-loading the value.',
  valueProp: 'Key value proposition',
}

function v(variant, key) {
  const val = (variant?.[key] || '').trim()
  return val || FALLBACK[key] || ''
}

const Swoosh = ({ size = 20 }) => (
  <img src="/capone-logo.webp" alt="Capital One" width={size} height={size} className="object-contain shrink-0" style={{ width: size, height: size }} />
)

export default function CreativePreview({ variant, channel }) {
  const Body = PREVIEWS[channel] || PREVIEWS['paid-search-rsa']
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Live preview</span>
        <span className="text-[10px] text-ink-300">Illustrative rendering</span>
      </div>
      <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3">
        <Body variant={variant} />
      </div>
    </div>
  )
}

// ---- Google Paid Search (RSA) ----
function PaidSearch({ variant }) {
  return (
    <div className="rounded-lg bg-white border border-ink-100 p-3 font-sans">
      <div className="flex items-center gap-2 mb-1">
        <Swoosh size={18} />
        <div className="leading-tight">
          <div className="text-[11px] text-ink-700 font-medium flex items-center gap-1">
            <span className="font-bold text-ink-900">Ad</span> · capitalone.com
          </div>
          <div className="text-[10px] text-ink-400">https://www.capitalone.com/credit-cards</div>
        </div>
      </div>
      <div className="text-[#1a0dab] text-[17px] leading-snug hover:underline cursor-pointer">{v(variant, 'headline')}</div>
      <div className="text-[13px] text-ink-600 mt-0.5 leading-snug">{v(variant, 'primaryText')}</div>
      {variant?.valueProp && <div className="text-[12px] text-ink-500 mt-1">· {v(variant, 'valueProp')}</div>}
    </div>
  )
}

// ---- Meta / Paid Social ----
function PaidSocial({ variant }) {
  return (
    <div className="rounded-lg bg-white border border-ink-100 overflow-hidden font-sans max-w-sm mx-auto">
      <div className="flex items-center gap-2 p-3">
        <span className="grid place-items-center h-9 w-9 rounded-full bg-white border border-ink-100"><Swoosh size={20} /></span>
        <div className="leading-tight flex-1">
          <div className="text-[13px] font-semibold text-ink-900">Capital One</div>
          <div className="text-[11px] text-ink-400">Sponsored · <span className="align-middle">🌐</span></div>
        </div>
        <MoreHorizontal size={18} className="text-ink-400" />
      </div>
      <div className="px-3 pb-2.5 text-[13px] text-ink-800 leading-snug">{v(variant, 'primaryText')}</div>
      <div className="relative bg-gradient-to-br from-brand-700 to-brand-900 aspect-[1.91/1] grid place-items-center px-5 text-center">
        <div className="text-white font-extrabold text-lg leading-tight drop-shadow">{v(variant, 'headline')}</div>
        {variant?.valueProp && <div className="absolute bottom-2 left-0 right-0 text-white/80 text-[11px]">{v(variant, 'valueProp')}</div>}
      </div>
      <div className="flex items-center justify-between bg-ink-50 px-3 py-2">
        <div className="text-[11px]">
          <div className="text-ink-400 uppercase tracking-wide">capitalone.com</div>
          <div className="font-semibold text-ink-800 text-[12px]">Learn more about the card</div>
        </div>
        <button className="rounded-md bg-ink-200 text-ink-800 text-[12px] font-semibold px-3 py-1.5">Apply now</button>
      </div>
      <div className="flex items-center justify-around text-ink-500 text-[12px] py-2 border-t border-ink-100">
        <span className="flex items-center gap-1.5"><ThumbsUp size={14} /> Like</span>
        <span className="flex items-center gap-1.5"><MessageCircle size={14} /> Comment</span>
        <span className="flex items-center gap-1.5"><Share2 size={14} /> Share</span>
      </div>
    </div>
  )
}

// ---- Display banner ----
function Display({ variant }) {
  return (
    <div className="mx-auto max-w-sm rounded-lg overflow-hidden border border-ink-100 shadow-sm bg-gradient-to-br from-brand-600 to-brand-800 text-white">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="grid place-items-center h-7 w-7 rounded bg-white"><Swoosh size={18} /></span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/80">Capital One</span>
        </div>
        <div className="font-extrabold text-xl leading-tight">{v(variant, 'headline')}</div>
        <div className="text-[12px] text-white/85 mt-1.5">{v(variant, 'primaryText')}</div>
        <div className="mt-3 flex items-center justify-between">
          {variant?.valueProp && <span className="text-[11px] text-white/70 max-w-[60%]">{v(variant, 'valueProp')}</span>}
          <button className="rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[12px] font-bold px-3.5 py-1.5 shadow">See if you're pre-approved</button>
        </div>
      </div>
    </div>
  )
}

// ---- Email ----
function Email({ variant }) {
  return (
    <div className="space-y-2.5 font-sans">
      <div className="rounded-lg bg-white border border-ink-100 p-2.5 flex items-start gap-2.5">
        <span className="grid place-items-center h-8 w-8 rounded-full bg-white border border-ink-100 shrink-0"><Swoosh size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink-900">Capital One</span>
            <span className="text-[10px] text-ink-400">now</span>
          </div>
          <div className="text-[13px] font-semibold text-ink-900 truncate">{v(variant, 'headline')}</div>
          <div className="text-[12px] text-ink-500 truncate">{v(variant, 'primaryText')}</div>
        </div>
        <Star size={14} className="text-ink-300 shrink-0" />
      </div>
      <div className="rounded-lg bg-white border border-ink-100 overflow-hidden">
        <div className="bg-brand-700 px-4 py-2.5 flex items-center gap-2">
          <span className="grid place-items-center h-6 w-6 rounded bg-white"><Swoosh size={16} /></span>
          <span className="text-white text-[12px] font-semibold tracking-wide">Capital One</span>
        </div>
        <div className="p-4">
          <div className="font-extrabold text-ink-900 text-base leading-tight">{v(variant, 'headline')}</div>
          <p className="text-[12.5px] text-ink-600 mt-2 leading-relaxed line-clamp-4 whitespace-pre-line">{v(variant, 'landingCopy') || v(variant, 'primaryText')}</p>
          <button className="mt-3 rounded-md bg-accent-600 text-white text-[12px] font-bold px-4 py-2">Apply now</button>
          {variant?.valueProp && <div className="text-[11px] text-ink-400 mt-3 border-t border-ink-100 pt-2">{v(variant, 'valueProp')}</div>}
        </div>
      </div>
    </div>
  )
}

// ---- Landing page ----
function Landing({ variant }) {
  return (
    <div className="rounded-lg bg-white border border-ink-100 overflow-hidden font-sans">
      <div className="flex items-center justify-between px-4 h-11 border-b border-ink-100">
        <span className="flex items-center gap-2"><Swoosh size={20} /><span className="text-[12px] font-bold text-ink-800">Capital One</span></span>
        <span className="flex items-center gap-1 text-[10px] text-ink-400"><Lock size={11} /> Secure</span>
      </div>
      <div className="px-5 py-6 bg-gradient-to-b from-brand-50 to-white text-center">
        <div className="font-extrabold text-ink-900 text-xl leading-tight max-w-md mx-auto">{v(variant, 'headline')}</div>
        <p className="text-[13px] text-ink-600 mt-2 max-w-md mx-auto">{v(variant, 'primaryText')}</p>
        <button className="mt-4 rounded-lg bg-accent-600 text-white text-[13px] font-bold px-5 py-2.5 shadow">Get started</button>
        {variant?.valueProp && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white border border-ink-100 px-3 py-1 text-[11px] text-ink-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {v(variant, 'valueProp')}
          </div>
        )}
      </div>
    </div>
  )
}

const PREVIEWS = {
  'paid-search-rsa': PaidSearch,
  'paid-social': PaidSocial,
  'display': Display,
  'email': Email,
  'landing-page': Landing,
}
