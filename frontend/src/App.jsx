import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, ChartNoAxesCombined, Settings,
  HelpCircle, Search, Plus, ArrowUpRight, ArrowDownLeft, ChevronDown, Menu,
  X, CreditCard, PiggyBank, LogOut, Trash2, RefreshCw, Pencil, LockKeyhole,
  UserRound, CircleHelp, CalendarDays,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
const CURRENCIES = ['USD', 'NGN', 'GBP', 'EUR', 'CAD']

function money(value, currency) {
  const amount = Number(value || 0)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function displayDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

async function apiRequest(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data?.detail
      || Object.entries(data || {}).map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : value}`
      ).join('\n')
      || `Request failed (${response.status})`
    throw new Error(detail)
  }
  return data
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const endpoint = mode === 'login' ? '/auth/login/' : '/auth/register/'
      const body = mode === 'login' ? { username, password } : { username, email, password }
      const data = await apiRequest(endpoint, { method: 'POST', body })
      if (!data?.token) throw new Error('The server did not return an authentication token.')
      onAuthenticated(data.token, data.user)
    } catch (err) {
      setError(err.message || 'Unable to authenticate.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9f8] p-5">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-7 shadow-sm sm:p-9">
        <Brand />
        <h2 className="text-2xl font-bold text-gray-900">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="mt-2 text-sm text-gray-500">{mode === 'login' ? 'Sign in to view and manage your finances.' : 'Create an account to start tracking your money.'}</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <Field label="Username"><input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className={inputClass} /></Field>
          {mode === 'register' && <Field label="Email"><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></Field>}
          <Field label="Password"><input required type="password" minLength={mode === 'register' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} /></Field>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            <LockKeyhole size={17} />{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="font-semibold text-emerald-700 hover:underline">{mode === 'login' ? 'Create one' : 'Sign in'}</button>
        </p>
      </div>
    </div>
  )
}

const inputClass = 'mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-emerald-500'
function Field({ label, children }) {
  return <label className="block text-sm font-medium text-gray-700">{label}{children}</label>
}
function ErrorMessage({ children }) {
  return <p className="whitespace-pre-line rounded-xl bg-red-50 p-3 text-sm text-red-700">{children}</p>
}
function Brand() {
  return <div className="mb-8 flex items-center gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white"><Wallet size={23} /></div>
    <div><h1 className="text-xl font-bold tracking-tight text-gray-900">Transtrack</h1><p className="text-xs text-gray-400">Personal Finance</p></div>
  </div>
}

function TransactionModal({ token, categories, initial, onClose, onSaved }) {
  const [type, setType] = useState(initial?.transaction_type || 'expense')
  const [category, setCategory] = useState(initial?.category ? String(initial.category) : '')
  const [amount, setAmount] = useState(initial?.amount || '')
  const [currency, setCurrency] = useState(initial?.currency || 'USD')
  const [description, setDescription] = useState(initial?.description || '')
  const [date, setDate] = useState(initial?.transaction_date || new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const availableCategories = categories.filter(item => item.category_type === type)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = { transaction_type: type, category: category ? Number(category) : null, amount, currency, description, transaction_date: date }
      const path = initial ? `/transactions/${initial.id}/` : '/transactions/'
      await apiRequest(path, { token, method: initial ? 'PATCH' : 'POST', body: payload })
      await onSaved()
    } catch (err) {
      setError(err.message || 'Could not save transaction.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-bold">{initial ? 'Edit transaction' : 'Add transaction'}</h3><button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={20} /></button></div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Transaction type"><select value={type} onChange={e => { setType(e.target.value); setCategory('') }} className={inputClass}><option value="income">Income</option><option value="expense">Expense</option></select></Field>
        <Field label="Amount"><input required min="0.01" step="0.01" type="number" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} /></Field>
        <Field label="Currency"><select value={currency} onChange={e => setCurrency(e.target.value)} className={inputClass}>{CURRENCIES.map(code => <option key={code}>{code}</option>)}</select></Field>
        <Field label="Category"><select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}><option value="">No category</option>{availableCategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Description"><input value={description} onChange={e => setDescription(e.target.value)} maxLength={255} placeholder="What was this transaction for?" className={inputClass} /></Field>
        <Field label="Date"><input required type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} /></Field>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold">Cancel</button><button disabled={busy} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save transaction'}</button></div>
      </form>
    </div>
  </div>
}

function StatCard({ label, value, note, icon: Icon, tone = 'green' }) {
  const tones = tone === 'orange' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
  return <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-500">{label}</p><div className={`rounded-lg p-2 ${tones}`}><Icon size={19} /></div></div>
    <h3 className="mt-5 break-words text-2xl font-bold tracking-tight">{value}</h3><p className="mt-4 text-xs text-gray-400">{note}</p>
  </div>
}

function TransactionsTable({ transactions, categories, onEdit, onDelete, loading }) {
  const [filter, setFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const filtered = transactions.filter(item => {
    const typeMatch = filter === 'All' || item.transaction_type === filter.toLowerCase()
    const category = categories.find(cat => cat.id === item.category)?.name || ''
    return typeMatch && `${item.description || ''} ${category}`.toLowerCase().includes(searchTerm.toLowerCase())
  })
  return <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 sm:px-6">
      <div><h3 className="font-bold">All transactions</h3><p className="mt-1 text-xs text-gray-400">View and manage your recorded activity</p></div>
      <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search transactions" className="w-48 rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-emerald-500" /></div>
    </div>
    <div className="flex gap-2 px-5 pt-4 sm:px-6">{['All', 'Income', 'Expense'].map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === item ? 'bg-emerald-50 text-emerald-700' : 'text-gray-400 hover:bg-gray-50'}`}>{item}</button>)}</div>
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left">
      <thead><tr className="text-xs text-gray-400"><th className="px-6 py-4 font-medium">Transaction</th><th className="px-6 py-4 font-medium">Category</th><th className="px-6 py-4 font-medium">Date</th><th className="px-6 py-4 font-medium">Amount</th><th className="px-6 py-4 font-medium">Type</th><th className="px-6 py-4 font-medium">Actions</th></tr></thead>
      <tbody>{filtered.map(item => {
        const type = item.transaction_type
        const category = categories.find(cat => cat.id === item.category)?.name || 'Uncategorized'
        return <tr key={item.id} className="border-t border-gray-50 hover:bg-gray-50/70">
          <td className="px-6 py-4"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${type === 'income' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>{type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</div><span className="text-sm font-semibold text-gray-800">{item.description || (type === 'income' ? 'Income' : 'Expense')}</span></div></td>
          <td className="px-6 py-4 text-sm text-gray-500">{category}</td><td className="px-6 py-4 text-sm text-gray-500">{displayDate(item.transaction_date)}</td>
          <td className={`px-6 py-4 text-sm font-semibold ${type === 'income' ? 'text-green-600' : 'text-gray-800'}`}>{type === 'income' ? '+' : '−'}{money(item.amount, item.currency)}</td>
          <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${type === 'income' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{type}</span></td>
          <td className="px-6 py-4"><div className="flex items-center gap-2"><button title="Edit" onClick={() => onEdit(item)} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-700"><Pencil size={15} /></button><button title="Delete" onClick={() => onDelete(item.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></div></td>
        </tr>
      })}{!filtered.length && <tr><td colSpan="6" className="px-6 py-10 text-center text-sm text-gray-400">{loading ? 'Loading transactions…' : 'No transactions found.'}</td></tr>}</tbody>
    </table></div>
    <div className="border-t border-gray-100 px-6 py-4 text-xs text-gray-400">Showing {filtered.length} of {transactions.length} transactions</div>
  </section>
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('transtrack_token'))
  const [user, setUser] = useState(null)
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [currency, setCurrency] = useState('USD')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState([])
  const [monthly, setMonthly] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const logout = useCallback(() => {
    localStorage.removeItem('transtrack_token')
    setToken(null); setUser(null); setTransactions([]); setCategories([]); setSummary([]); setMonthly([])
    setActiveNav('Dashboard')
  }, [])

  const loadData = useCallback(async (activeToken) => {
    setLoading(true); setError('')
    try {
      const [profile, transactionData, categoryData, summaryData, monthlyData] = await Promise.all([
        apiRequest('/auth/profile/', { token: activeToken }),
        apiRequest('/transactions/', { token: activeToken }),
        apiRequest('/categories/', { token: activeToken }),
        apiRequest('/dashboard/summary/', { token: activeToken }),
        apiRequest('/dashboard/monthly-summary/', { token: activeToken }),
      ])
      setUser(profile)
      setTransactions(Array.isArray(transactionData) ? transactionData : transactionData?.results || [])
      setCategories(Array.isArray(categoryData) ? categoryData : categoryData?.results || [])
      setSummary(Array.isArray(summaryData) ? summaryData : [])
      setMonthly(Array.isArray(monthlyData) ? monthlyData : [])
      if (Array.isArray(summaryData) && summaryData.length && !summaryData.some(item => item.currency === currency)) setCurrency(summaryData[0].currency)
    } catch (err) {
      if (/401|403|invalid token|authentication/i.test(err.message)) logout()
      else setError(err.message || 'Could not load your finance data.')
    } finally { setLoading(false) }
  }, [currency, logout])

  useEffect(() => {
    if (token) { localStorage.setItem('transtrack_token', token); loadData(token) }
  }, [token, loadData])

  function authenticated(newToken, newUser) {
    localStorage.setItem('transtrack_token', newToken)
    setUser(newUser || null); setToken(newToken)
  }

  async function deleteTransaction(id) {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return
    try { await apiRequest(`/transactions/${id}/`, { token, method: 'DELETE' }); await loadData(token) }
    catch (err) { setError(err.message || 'Could not delete transaction.') }
  }

  const currentSummary = summary.find(item => item.currency === currency)
  const totalIncome = Number(currentSummary?.total_income || 0)
  const totalExpenses = Number(currentSummary?.total_expenses || 0)
  const balance = Number(currentSummary?.balance || 0)
  const chartData = useMemo(() => monthly.filter(item => item.currency === currency).map(item => ({
    month: new Date(`${item.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    income: Number(item.total_income || 0), expenses: Number(item.total_expenses || 0), monthKey: item.month,
  })), [monthly, currency])

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Transactions', icon: ArrowLeftRight },
    { name: 'Accounts', icon: Wallet },
    { name: 'Reports', icon: ChartNoAxesCombined },
  ]

  if (!token) return <AuthScreen onAuthenticated={authenticated} />

  const openNav = name => { setActiveNav(name); setMobileOpen(false) }
  const sidebar = <div className="flex h-full flex-col">
    <div className="px-6 py-7"><Brand /></div>
    <div className="px-4"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Workspace</p><nav className="space-y-1">
      {navigation.map(({ name, icon: Icon }) => <button key={name} onClick={() => openNav(name)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${activeNav === name ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><Icon size={19} />{name}</button>)}
    </nav></div>
    <div className="mt-9 px-4"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Preferences</p>
      <button onClick={() => openNav('Settings')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${activeNav === 'Settings' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'}`}><Settings size={19} />Settings</button>
      <button onClick={() => openNav('Help & Support')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${activeNav === 'Help & Support' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'}`}><HelpCircle size={19} />Help & Support</button>
    </div>
    <div className="mt-auto p-4"><div className="rounded-2xl bg-emerald-50 p-4"><div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-700"><PiggyBank size={20} /></div><p className="text-sm font-semibold text-gray-800">Stay on top of your money</p><p className="mt-1 text-xs leading-5 text-gray-500">Track your finances and make smarter decisions.</p></div>
      <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{(user?.username || 'U').slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user?.username || 'Account'}</p><p className="truncate text-xs text-gray-400">{user?.email || 'Transtrack account'}</p></div><button onClick={logout} title="Sign out" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><LogOut size={18} /><span className="hidden lg:inline">Logout</span></button></div>
    </div>
  </div>

  function pageTitle() {
    return ({ Dashboard: 'Financial Overview', Transactions: 'Transactions', Accounts: 'Accounts', Reports: 'Reports', Settings: 'Settings', 'Help & Support': 'Help & Support' })[activeNav]
  }

  function DashboardPage() {
    return <>
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm text-gray-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Financial Overview</h2><p className="mt-1 text-sm text-gray-500">Here's what's happening with your money.</p></div><button onClick={() => { setEditing(null); setModalOpen(true) }} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"><Plus size={18} />Add transaction</button></section>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"><div className="rounded-2xl bg-emerald-700 p-6 text-white shadow-sm sm:col-span-2 xl:col-span-1"><div className="flex items-center justify-between"><p className="text-sm font-medium text-emerald-100">Balance · {currency}</p><div className="rounded-lg bg-white/10 p-2"><Wallet size={19} /></div></div><h3 className="mt-5 break-words text-3xl font-bold">{money(balance, currency)}</h3><div className="mt-5 flex items-center gap-2 text-sm text-emerald-100"><ArrowUpRight size={17} /><span>Income minus expenses in {currency}</span></div><div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4 text-xs text-emerald-100"><span>Only this currency</span><span>{currency}</span></div></div>
        <StatCard label="Total income" value={money(totalIncome, currency)} note={`Recorded income in ${currency}`} icon={ArrowDownLeft} /><StatCard label="Total expenses" value={money(totalExpenses, currency)} note={`Recorded expenses in ${currency}`} icon={ArrowUpRight} tone="orange" /></section>
      <section className="grid gap-5 xl:grid-cols-3"><div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2"><h3 className="font-bold text-gray-900">Income vs Expenses</h3><p className="mt-1 text-xs text-gray-400">Monthly activity in {currency}</p><div className="mt-5 h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity={0.18} /><stop offset="100%" stopColor="#059669" stopOpacity={0} /></linearGradient><linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb923c" stopOpacity={0.15} /><stop offset="100%" stopColor="#fb923c" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#f0f2f1" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} /><Tooltip formatter={value => money(value, currency)} /><Area type="monotone" dataKey="income" stroke="#059669" strokeWidth={2.5} fill="url(#incomeGradient)" /><Area type="monotone" dataKey="expenses" stroke="#fb923c" strokeWidth={2.5} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></div>{!chartData.length && <p className="text-center text-sm text-gray-400">No monthly activity recorded in {currency} yet.</p>}</div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><h3 className="font-bold">Currency overview</h3><p className="mt-1 text-xs text-gray-400">Balances are kept separate</p><div className="mt-5 space-y-3">{summary.length ? summary.map(item => <button key={item.currency} onClick={() => setCurrency(item.currency)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${currency === item.currency ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><span><span className="block text-sm font-semibold text-gray-800">{item.currency}</span><span className="text-xs text-gray-400">Income {money(item.total_income, item.currency)}</span></span><span className="text-sm font-bold text-gray-800">{money(item.balance, item.currency)}</span></button>) : <p className="py-5 text-sm text-gray-400">Currency summaries appear when you add transactions.</p>}</div><div className="mt-5 rounded-xl bg-gray-50 p-4"><div className="flex items-center gap-2 text-emerald-700"><CreditCard size={18} /><span className="text-sm font-semibold">Currency note</span></div><p className="mt-2 text-xs leading-5 text-gray-500">Different currencies are not added together or converted without an exchange rate.</p></div></div></section>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">Recent transactions</h3><p className="mt-1 text-xs text-gray-400">Your latest recorded activity</p></div><button onClick={() => openNav('Transactions')} className="text-sm font-semibold text-emerald-700 hover:underline">View all</button></div><TransactionsTable transactions={transactions.slice(0, 5)} categories={categories} onEdit={item => { setEditing(item); setModalOpen(true) }} onDelete={deleteTransaction} loading={loading} /></section>
    </>
  }

  function AccountsPage() {
    return <><div><h2 className="text-2xl font-bold">Your currency accounts</h2><p className="mt-1 text-sm text-gray-500">Transtrack keeps each currency separate. These balances are calculated from your transactions.</p></div>
      {summary.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{summary.map(item => <button key={item.currency} onClick={() => setCurrency(item.currency)} className={`rounded-2xl border bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 ${currency === item.currency ? 'border-emerald-300 ring-2 ring-emerald-50' : 'border-gray-100'}`}><div className="flex items-center justify-between"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Wallet size={22} /></span><span className="text-sm font-semibold text-gray-500">{item.currency}</span></div><p className="mt-5 text-sm text-gray-500">Available balance</p><h3 className="mt-1 text-2xl font-bold">{money(item.balance, item.currency)}</h3><div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4"><div><p className="text-xs text-gray-400">Income</p><p className="mt-1 text-sm font-semibold text-green-600">{money(item.total_income, item.currency)}</p></div><div><p className="text-xs text-gray-400">Expenses</p><p className="mt-1 text-sm font-semibold text-orange-600">{money(item.total_expenses, item.currency)}</p></div></div></button>)}</div> : <EmptyState title="No accounts to show yet" text="Add a transaction to create your first currency balance." action={() => setModalOpen(true)} />}
      <div className="rounded-2xl border border-gray-100 bg-white p-6"><h3 className="font-bold">How currency accounts work</h3><p className="mt-2 text-sm leading-6 text-gray-500">Each account represents a currency used in your transactions. Transtrack does not combine USD, NGN, GBP or other currencies into one total. Select a currency to make it the active currency on your dashboard.</p></div>
    </>
  }

  function ReportsPage() {
    return <><div><h2 className="text-2xl font-bold">Financial reports</h2><p className="mt-1 text-sm text-gray-500">Review your monthly income, expenses and balance by currency.</p></div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4"><label className="text-sm font-medium text-gray-600">Report currency</label><select value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">{[...new Set([...CURRENCIES, ...summary.map(item => item.currency)])].map(code => <option key={code}>{code}</option>)}</select><span className="text-xs text-gray-400">Amounts are shown only in the selected currency.</span></div>
      <div className="grid gap-5 sm:grid-cols-3"><StatCard label="Total income" value={money(totalIncome, currency)} note="All recorded income" icon={ArrowDownLeft} /><StatCard label="Total expenses" value={money(totalExpenses, currency)} note="All recorded expenses" icon={ArrowUpRight} tone="orange" /><StatCard label="Net balance" value={money(balance, currency)} note="Income less expenses" icon={Wallet} /></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h3 className="font-bold">Monthly comparison</h3><p className="mt-1 text-xs text-gray-400">Income and expenses by month · {currency}</p><div className="mt-5 h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="#f0f2f1" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip formatter={value => money(value, currency)} /><Legend /><Bar dataKey="income" name="Income" fill="#059669" radius={[5, 5, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#fb923c" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>{!chartData.length && <p className="text-center text-sm text-gray-400">No monthly report data for {currency} yet.</p>}</div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white"><div className="border-b border-gray-100 p-5"><h3 className="font-bold">Monthly breakdown</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs text-gray-400"><tr><th className="px-5 py-4">Month</th><th className="px-5 py-4">Income</th><th className="px-5 py-4">Expenses</th><th className="px-5 py-4">Balance</th></tr></thead><tbody>{chartData.map(item => <tr key={item.monthKey} className="border-t border-gray-50"><td className="px-5 py-4 font-medium">{item.month}</td><td className="px-5 py-4 text-green-600">{money(item.income, currency)}</td><td className="px-5 py-4 text-orange-600">{money(item.expenses, currency)}</td><td className="px-5 py-4 font-semibold">{money(item.income - item.expenses, currency)}</td></tr>)}{!chartData.length && <tr><td colSpan="4" className="px-5 py-8 text-center text-gray-400">No monthly data available.</td></tr>}</tbody></table></div></div>
    </>
  }

  function SettingsPage() {
    return <><div><h2 className="text-2xl font-bold">Account settings</h2><p className="mt-1 text-sm text-gray-500">View your account details and dashboard preferences.</p></div>
      <div className="max-w-3xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className="flex items-center gap-4 border-b border-gray-100 pb-6"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-700">{(user?.username || 'U').slice(0, 2).toUpperCase()}</div><div><h3 className="font-bold">{user?.username || 'Transtrack user'}</h3><p className="text-sm text-gray-500">{user?.email || 'No email available'}</p></div></div>
        <div className="grid gap-5 py-6 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Username</p><p className="mt-2 text-sm font-medium">{user?.username || '—'}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email address</p><p className="mt-2 text-sm font-medium">{user?.email || '—'}</p></div></div>
        <div className="border-t border-gray-100 pt-6"><label className="block text-sm font-semibold">Default dashboard currency<select value={currency} onChange={e => setCurrency(e.target.value)} className={inputClass}>{[...new Set([...CURRENCIES, ...summary.map(item => item.currency)])].map(code => <option key={code}>{code}</option>)}</select></label><p className="mt-2 text-xs text-gray-400">This changes the currency displayed in your dashboard. It does not convert or modify existing transactions.</p></div>
        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">Profile details are currently read-only. Changing your email or password will require an account-update endpoint in the backend.</div>
      </div>
      <div className="max-w-3xl rounded-2xl border border-red-100 bg-white p-6"><h3 className="font-bold text-gray-900">Sign out</h3><p className="mt-1 text-sm text-gray-500">Sign out of Transtrack on this browser.</p><button onClick={logout} className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={17} />Logout</button></div>
    </>
  }

  function HelpPage() {
    return <><div><h2 className="text-2xl font-bold">Help & Support</h2><p className="mt-1 text-sm text-gray-500">A few basics to help you use Transtrack.</p></div>
      <div className="grid max-w-4xl gap-4">{[
        ['How do I record income or an expense?', 'Choose Add transaction, select the transaction type, enter the amount, currency, date and any optional category or description, then save.'],
        ['Can I track more than one currency?', 'Yes. Choose a currency when adding each transaction. Transtrack keeps balances separate and does not add different currencies together.'],
        ['How do I correct a transaction?', 'Open Transactions and use the pencil icon to edit a record or the trash icon to delete it. Deletion cannot be undone.'],
        ['Why is my report empty?', 'Reports are based on saved transactions. Add income or expense transactions to populate your monthly summaries.'],
        ['How do I sign out?', 'Use the Logout option at the bottom of the sidebar or in Settings.'],
      ].map(([question, answer]) => <div key={question} className="rounded-2xl border border-gray-100 bg-white p-5"><div className="flex items-start gap-3"><CircleHelp size={19} className="mt-0.5 text-emerald-600" /><div><h3 className="font-semibold">{question}</h3><p className="mt-2 text-sm leading-6 text-gray-500">{answer}</p></div></div></div>)}</div>
      <div className="max-w-4xl rounded-2xl bg-emerald-50 p-5"><h3 className="font-semibold text-emerald-900">Need more help?</h3><p className="mt-1 text-sm text-emerald-800">Support contact details can be added here when a support email address is configured.</p></div>
    </>
  }

  function EmptyState({ title, text, action }) {
    return <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center"><CalendarDays className="mx-auto text-gray-300" size={30} /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm text-gray-500">{text}</p><button onClick={action} className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">Add transaction</button></div>
  }

  let pageContent
  if (activeNav === 'Dashboard') pageContent = <DashboardPage />
  else if (activeNav === 'Transactions') pageContent = <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Your transactions</h2><p className="mt-1 text-sm text-gray-500">Add, search, edit and delete your financial activity.</p></div><button onClick={() => { setEditing(null); setModalOpen(true) }} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"><Plus size={18} />Add transaction</button></div><TransactionsTable transactions={transactions} categories={categories} onEdit={item => { setEditing(item); setModalOpen(true) }} onDelete={deleteTransaction} loading={loading} /></>
  else if (activeNav === 'Accounts') pageContent = <AccountsPage />
  else if (activeNav === 'Reports') pageContent = <ReportsPage />
  else if (activeNav === 'Settings') pageContent = <SettingsPage />
  else pageContent = <HelpPage />

  return <div className="min-h-screen bg-[#f7f9f8]">
    {modalOpen && <TransactionModal token={token} categories={categories} initial={editing} onClose={() => { setModalOpen(false); setEditing(null) }} onSaved={async () => { setModalOpen(false); setEditing(null); await loadData(token) }} />}
    {mobileOpen && <div className="fixed inset-0 z-50 flex md:hidden"><div className="w-72 bg-white shadow-xl"><div className="flex justify-end p-3"><button onClick={() => setMobileOpen(false)}><X size={22} /></button></div>{sidebar}</div><button aria-label="Close navigation" className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} /></div>}
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-gray-100 bg-white md:block">{sidebar}</aside>
    <main className="min-h-screen md:ml-64"><header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-gray-100 bg-white/90 px-5 backdrop-blur md:px-9"><div className="flex items-center gap-3"><button className="text-gray-600 md:hidden" onClick={() => setMobileOpen(true)}><Menu size={23} /></button><div><h2 className="text-lg font-bold">{pageTitle()}</h2><p className="hidden text-xs text-gray-400 sm:block">Your personal financial workspace.</p></div></div><div className="flex items-center gap-3 sm:gap-5"><button onClick={() => loadData(token)} title="Refresh data" className="text-gray-400 hover:text-gray-700"><RefreshCw size={18} /></button><div className="hidden h-8 w-px bg-gray-100 sm:block" /><label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"><span>{currency}</span><ChevronDown size={15} /><select aria-label="Dashboard currency" value={currency} onChange={e => setCurrency(e.target.value)} className="absolute h-8 w-[78px] cursor-pointer opacity-0">{[...new Set([...CURRENCIES, ...summary.map(item => item.currency)])].map(code => <option key={code}>{code}</option>)}</select></label></div></header>
      <div className="mx-auto max-w-[1500px] space-y-7 p-5 md:p-9">{error && <div className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><span className="whitespace-pre-line">{error}</span><button onClick={() => setError('')}><X size={17} /></button></div>}{loading && <div className="rounded-xl bg-white p-3 text-sm text-gray-500">Loading your financial data…</div>}{pageContent}<footer className="pb-3 pt-5 text-center text-xs text-gray-400">Transtrack © 2026. Manage your money with clarity.</footer></div>
    </main>
  </div>
}

export default App
