import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity as ActivityIcon, ArrowLeft, ArrowRight, BarChart3, Check,
  CheckCircle2, CircleHelp, Clock3, FilePlus2, Filter, Headphones, LayoutDashboard,
  LogOut, MessageSquareText, Search, ShieldCheck, Ticket as TicketIcon, Users,
} from 'lucide-react';
import {
  useAddTicketComment, useCreateTicket, useGetAdminAnalytics, useGetCurrentUser, useGetDashboardSummary,
  useGetRecentActivity, useGetTicket, useListAgents, useListTickets, useListUsers, useLoginUser,
  useLogoutUser, useRegisterUser, useUpdateTicket, useUpdateUserRole, getGetCurrentUserQueryKey,
  getGetDashboardSummaryQueryKey, getGetAdminAnalyticsQueryKey, getGetRecentActivityQueryKey,
  getListTicketsQueryKey, getGetTicketQueryKey, getListAgentsQueryKey, getListUsersQueryKey,
} from '@workspace/api-client-react';
import type { Ticket, TicketStatus, TicketPriority, User, UserRole } from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter, useParams } from 'wouter';
import { format, formatDistanceToNow } from 'date-fns';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const categories = ['Technical Issue', 'Account / Login', 'Network', 'Hardware', 'Software', 'Payment', 'Academic', 'General Query', 'Other'];
const priorities: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const sessionHintKey = 'supportflow-session-active';
const demoAccounts = [
  { role: 'Student', email: 'student@supportflow.demo' },
  { role: 'Agent', email: 'agent@supportflow.demo' },
  { role: 'Admin', email: 'admin@supportflow.demo' },
];
const labelStatus = (status: string) => status === 'IN_PROGRESS' ? 'In progress' : status.charAt(0) + status.slice(1).toLowerCase();
const initials = (name?: string) => (name || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const niceDate = (value: string) => { try { return format(new Date(value), 'MMM d, yyyy'); } catch { return value; } };
const errorText = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
};

function Brand() {
  return <span className="brand"><span className="brand-mark"><Headphones size={18} strokeWidth={2.3} /></span>SUPPORTFLOW</span>;
}
function StatusPill({ status }: { status: string }) { return <span className={`pill pill-${status.toLowerCase()}`} data-testid={`status-${status.toLowerCase()}`}>{labelStatus(status)}</span>; }
function PriorityPill({ priority }: { priority: string }) { return <span className={`pill pill-${priority.toLowerCase()}`}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>; }
function LoadingPanel() { return <div className="panel" style={{ padding: 24 }}><div className="skeleton" style={{ width: '35%', marginBottom: 16 }} /><div className="skeleton" style={{ width: '75%', marginBottom: 12 }} /><div className="skeleton" style={{ width: '54%' }} /></div>; }
function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <div className="panel error-state"><div className="empty-icon"><CircleHelp size={22} /></div><h2>We couldn’t load this view</h2><p>{message}</p><button className="button" onClick={retry} data-testid="button-retry">Try again</button></div>;
}
function EmptyPanel({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><TicketIcon size={21} /></div><h2>{title}</h2><p>{text}</p>{action}</div>;
}
function TicketRows({ tickets }: { tickets: Ticket[] }) {
  if (!tickets?.length) return <EmptyPanel title="Nothing in your queue" text="When a support request appears, it will show up here." />;
  return <><div className="table-labels"><span>Ticket</span><span>Category</span><span>Priority</span><span>Created</span><span>Status</span><span>Action</span></div>
    {tickets.map((ticket) => <Link href={`/tickets/${ticket.id}`} key={ticket.id} className="ticket-row" data-testid={`link-ticket-${ticket.id}`}>
      <div><div className="ticket-title">{ticket.title}</div><div className="ticket-id">{ticket.ticketNumber} · {ticket.createdByName} · {ticket.assignedToName ? `Assigned to ${ticket.assignedToName}` : 'Unassigned'}</div></div>
      <div className="muted-small">{ticket.category}</div><div className="ticket-priority"><PriorityPill priority={ticket.priority} /></div>
      <div className="ticket-date muted-small">{niceDate(ticket.createdAt)}</div><div className="ticket-status"><StatusPill status={ticket.status} /></div>
      <span className="ticket-action">View <ArrowRight size={12} /></span>
    </Link>)}</>;
}
function PageHeading({ kicker, title, description, children }: { kicker: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{kicker}</div><h1>{title}</h1><p className="subheading">{description}</p></div>{children}</div>;
}

function Landing() {
  const [, setLocation] = useLocation();
  const hasSessionHint = typeof window !== 'undefined' && window.localStorage.getItem(sessionHintKey) === 'true';
  const { data: user, isSuccess } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false, enabled: hasSessionHint } });
  useEffect(() => { if (isSuccess && user) setLocation('/dashboard'); }, [isSuccess, user, setLocation]);
  if (isSuccess && user) return null;
  return <main className="landing">
    <nav className="landing-nav"><Brand /><div style={{ display: 'flex', gap: 9 }}><Link href="/login" className="button button-quiet">Sign In</Link><Link href="/register" className="button button-primary">Get Started <ArrowRight size={14} /></Link></div></nav>
    <section className="landing-hero">
      <div><div className="eyebrow">CAMPUS SUPPORT, ALL IN ONE PLACE</div><h1>Support, <span style={{ color: '#6755d2' }}>Simplified.</span></h1><p>Create, track and resolve support requests from one powerful platform.</p><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Link href="/register" className="button button-primary" style={{ padding: '13px 18px' }}>Get Started <ArrowRight size={15} /></Link><Link href="/login" className="button" style={{ padding: '13px 18px' }}>Sign In</Link></div><div style={{ marginTop: 17, color: '#827f97', fontSize: 10 }}>For students, support agents, and campus administrators</div></div>
      <div className="hero-art"><div className="orbit" /><div className="orbit two" /><div className="hero-ticket"><div className="hero-ticket-top"><span>REQUEST · SF-2841</span><StatusPill status="IN_PROGRESS" /></div><h3>Campus Wi-Fi drops in library</h3><p>The network team is looking into your report. We’ll keep the updates right here.</p><div className="hero-ticket-foot"><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="avatar">JC</div><span style={{ fontSize: 10, fontWeight: 700 }}>Jordan Chen · Support</span></div><span className="muted-small">12 min ago</span></div></div><div className="float-note"><span style={{ color: '#398365', fontWeight: 800 }}>●</span> Updates stay with your request</div></div>
    </section>
    <section className="landing-section tint"><div className="eyebrow">BUILT FOR CAMPUS SUPPORT</div><h2>Everything support needs, in one place.</h2><p className="subheading">From the first request to a clear resolution.</p><div className="feature-grid">
      <article className="feature"><div className="feature-icon"><TicketIcon size={18} /></div><h3>Smart Ticketing</h3><p>Capture requests with the right category, context, and urgency from the start.</p></article>
      <article className="feature"><div className="feature-icon"><ActivityIcon size={18} /></div><h3>Fast Resolution</h3><p>Assign work clearly and keep every ticket moving toward a useful answer.</p></article>
      <article className="feature"><div className="feature-icon"><MessageSquareText size={18} /></div><h3>Team Collaboration</h3><p>Keep comments and decisions alongside the request for everyone who needs context.</p></article>
      <article className="feature"><div className="feature-icon"><BarChart3 size={18} /></div><h3>Real-Time Analytics</h3><p>Give administrators a live view of ticket volume, status, and support activity.</p></article>
    </div></section>
    <section className="landing-section"><div className="eyebrow">A SIMPLE, VISIBLE WORKFLOW</div><h2>From request to resolution.</h2><div className="landing-steps">
      <div className="step"><div className="step-number">01</div><h3>CREATE</h3><p>Submit the request with its category and urgency.</p></div>
      <div className="step"><div className="step-number">02</div><h3>ASSIGN</h3><p>Connect the ticket with the right support agent.</p></div>
      <div className="step"><div className="step-number">03</div><h3>RESOLVE</h3><p>Share updates and move work to a resolution.</p></div>
      <div className="step"><div className="step-number">04</div><h3>CLOSE</h3><p>Finish the request with its outcome recorded.</p></div>
    </div></section>
    <section className="landing-section tint" style={{ textAlign: 'center' }}><div className="eyebrow">Your campus, connected</div><h2>Ready when you need a hand.</h2><p className="subheading" style={{ margin: '0 auto 22px', maxWidth: 470 }}>A dependable support workspace for the people who learn here and the teams who help them.</p><Link href="/register" className="button button-primary">Create your student account <ArrowRight size={15} /></Link></section>
    <footer className="landing-footer">SupportFlow · Campus support, clearly in motion</footer>
  </main>;
}

function AuthLayout({ children, title, copy }: { children: ReactNode; title: string; copy: string }) {
  return <main className="auth-wrap"><section className="auth-story"><Brand /><div className="auth-story-copy"><div className="eyebrow" style={{ color: '#c8bfff' }}>SupportFlow workspace</div><h1>{title}</h1><p>{copy}</p></div><footer style={{ color: '#bdb7db', fontSize: 10, position: 'relative', zIndex: 1 }}>A little more clarity for campus life.</footer></section><section className="auth-main">{children}</section></main>;
}
function Login() {
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const login = useLoginUser({ mutation: { onSuccess: async () => { window.localStorage.setItem(sessionHintKey, 'true'); await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/dashboard'); } } });
  const submit = (event: FormEvent) => { event.preventDefault(); setError(''); if (!email.trim() || !password) { setError('Enter your email and password to continue.'); return; } login.mutate({ data: { email: email.trim(), password } }, { onError: (err) => setError(errorText(err)) }); };
  const fillDemo = (account: typeof demoAccounts[number]) => { setEmail(account.email); setPassword(''); setError(''); document.getElementById('login-password')?.focus(); };
  return <AuthLayout title="Good support starts with a clear next step." copy="Sign in to follow requests, pick up your support queue, or keep campus services moving.">
    <div className="auth-card"><div className="eyebrow">Welcome back</div><h2>Sign in</h2><p className="subheading">Use your SupportFlow account to continue.</p>
      {error && <div className="notice" role="alert">{error}</div>}
      <form onSubmit={submit}><div className="field"><label htmlFor="login-email">Email address</label><input id="login-email" className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@college.edu" data-testid="input-email" /></div><div className="field"><label htmlFor="login-password">Password</label><input id="login-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" data-testid="input-password" /></div><button className="button button-primary" style={{ width: '100%', marginTop: 3 }} disabled={login.isPending} data-testid="button-login">{login.isPending ? 'Signing in…' : 'Sign in'} <ArrowRight size={15} /></button></form>
      <div className="demo-box"><div className="demo-title">Demo accounts · email shortcuts</div>{demoAccounts.map((account) => <div className="demo-line" key={account.role}><span>{account.role}<br />{account.email}</span><button type="button" className="demo-fill" onClick={() => fillDemo(account)} data-testid={`button-demo-${account.role.toLowerCase()}`}>Use email</button></div>)}</div>
      <p style={{ margin: '22px 0 0', textAlign: 'center', fontSize: 12, color: '#77758a' }}>New to SupportFlow? <Link href="/register" style={{ color: '#5947c7', fontWeight: 700, textDecoration: 'none' }}>Create an account</Link></p>
    </div>
  </AuthLayout>;
}
function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState('');
  const register = useRegisterUser({ mutation: { onSuccess: async () => { window.localStorage.setItem(sessionHintKey, 'true'); await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/dashboard'); } } });
  const submit = (event: FormEvent) => { event.preventDefault(); setError(''); if (name.trim().length < 2) return setError('Please enter your name (at least 2 characters).'); if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.'); if (password.length < 8) return setError('Your password needs at least 8 characters.'); if (password !== confirm) return setError('Those passwords do not match.'); register.mutate({ data: { name: name.trim(), email: email.trim(), password } }, { onError: (err) => setError(errorText(err)) }); };
  return <AuthLayout title="Make room for one less thing to worry about." copy="Create your student account to submit requests and follow every update, all in one place.">
    <div className="auth-card"><div className="eyebrow">Student account</div><h2>Create your account</h2><p className="subheading">Set up your student support workspace.</p>{error && <div className="notice" role="alert">{error}</div>}
      <form onSubmit={submit}><div className="field"><label htmlFor="register-name">Full name</label><input id="register-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" data-testid="input-name" /></div><div className="field"><label htmlFor="register-email">College email</label><input id="register-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@college.edu" data-testid="input-register-email" /></div><div className="field"><label htmlFor="register-password">Password</label><input id="register-password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" data-testid="input-register-password" /></div><div className="field"><label htmlFor="register-confirm">Confirm password</label><input id="register-confirm" className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Type it again" data-testid="input-confirm-password" /></div><button className="button button-primary" style={{ width: '100%' }} disabled={register.isPending} data-testid="button-register">{register.isPending ? 'Creating account…' : 'Create student account'} <ArrowRight size={15} /></button></form>
      <p style={{ margin: '22px 0 0', textAlign: 'center', fontSize: 12, color: '#77758a' }}>Already have an account? <Link href="/login" style={{ color: '#5947c7', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link></p>
    </div>
  </AuthLayout>;
}

function AppShell({ children, user }: { children: ReactNode; user: User }) {
  const [location, setLocation] = useLocation(); const logout = useLogoutUser();
  const links = [{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard }, { href: '/tickets/create', label: 'New request', icon: FilePlus2 }, ...(user.role !== 'USER' ? [{ href: '/admin', label: 'Administration', icon: BarChart3 }, { href: '/admin/users', label: 'Users & roles', icon: Users }] : [])];
  const active = (href: string) => href === '/dashboard' ? location === href : location === href || location.startsWith(`${href}/`);
  const signout = () => logout.mutate(undefined, { onSuccess: async () => { window.localStorage.removeItem(sessionHintKey); await queryClient.clear(); setLocation('/login'); }, onError: () => { window.localStorage.removeItem(sessionHintKey); setLocation('/login'); } });
  const navlinks = links.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`nav-item ${active(item.href) ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}><Icon size={17} strokeWidth={1.8} />{item.label}</Link>; });
  return <div className="app-shell"><aside className="sidebar"><Brand /><div className="nav-label">Workspace</div>{navlinks}<div className="side-bottom"><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 3px 15px' }}><div className="avatar" style={{ background: '#514675', color: 'white' }}>{initials(user.name)}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div><div style={{ color: '#aaa5c0', fontSize: 9, marginTop: 3 }}>{user.role === 'USER' ? 'Student' : user.role === 'AGENT' ? 'Support agent' : 'Administrator'}</div></div></div><button className="nav-item" style={{ border: 0, background: 'transparent', width: '100%', cursor: 'pointer' }} onClick={signout} disabled={logout.isPending} data-testid="button-logout"><LogOut size={16} />{logout.isPending ? 'Signing out…' : 'Sign out'}</button></div></aside>
    <div className="main-area"><header className="topbar"><div className="topbar-title">{location.startsWith('/admin') ? 'Administration' : location.startsWith('/tickets') ? 'Support requests' : 'Support workspace'}</div><div className="user-mini"><span>{user.name}</span><div className="avatar">{initials(user.name)}</div></div></header>{children}</div>
    <nav className="mobile-nav">{links.slice(0, 4).map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={active(item.href) ? 'active' : ''}><Icon size={18} /><span>{item.label}</span></Link>; })}</nav></div>;
}
function Protected({ children, roles }: { children: (user: User) => ReactNode; roles?: UserRole[] }) {
  const [, setLocation] = useLocation(); const current = useGetCurrentUser();
  if (current.isLoading) return <div className="content"><LoadingPanel /></div>;
  if (current.isError || !current.data) return <Unauthorized onLogin={() => setLocation('/login')} />;
  if (roles && !roles.includes(current.data.role)) return <AppShell user={current.data}><div className="content"><div className="panel empty-state"><div className="empty-icon"><ShieldCheck /></div><h2>That area is restricted</h2><p>Your current account doesn’t have access to this page.</p><Link className="button" href="/dashboard">Back to your dashboard</Link></div></div></AppShell>;
  return <AppShell user={current.data}>{children(current.data)}</AppShell>;
}
function Unauthorized({ onLogin }: { onLogin: () => void }) {
  return <main className="auth-main" style={{ minHeight: '100dvh' }}><div className="panel empty-state" style={{ maxWidth: 440, padding: 34 }}><div className="empty-icon"><ShieldCheck /></div><div className="eyebrow">Sign-in required</div><h2>Your support workspace is waiting</h2><p>Sign in to see requests associated with your account.</p><button className="button button-primary" onClick={onLogin} data-testid="button-go-login">Go to sign in</button></div></main>;
}

function Dashboard({ user }: { user: User }) {
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>(''); const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const ticketFilters = { search: search || undefined, status: statusFilter || undefined, priority: priorityFilter || undefined };
  const summary = useGetDashboardSummary();
  const tickets = useListTickets(ticketFilters, { query: { queryKey: getListTicketsQueryKey(ticketFilters) } });
  const counts = summary.data;
  const staff = user.role !== 'USER';
  return <div className="content"><PageHeading kicker={staff ? 'Support queue' : 'Your workspace'} title={staff ? `Good to see you, ${user.name.split(' ')[0]}.` : `Welcome back, ${user.name.split(' ')[0]}`} description={staff ? 'Keep campus requests moving, with every update on the record.' : 'Here’s the latest across your support requests.'} ><Link href="/tickets/create" className="button button-primary"><FilePlus2 size={15} /> Create Ticket</Link></PageHeading>
    {summary.isLoading ? <><div className="metric-grid">{[1, 2, 3, 4].map((n) => <div className="panel metric" key={n}><div className="skeleton" style={{ width: 85 }} /><div className="skeleton" style={{ width: 45, height: 28, marginTop: 19 }} /></div>)}</div><LoadingPanel /></> :
    summary.isError ? <ErrorPanel message={errorText(summary.error)} retry={() => summary.refetch()} /> : <>
      <div className="metric-grid">{[{ label: 'Total Tickets', value: counts?.total || 0, icon: TicketIcon }, { label: 'Open', value: counts?.open || 0, icon: Clock3 }, { label: 'In progress', value: counts?.inProgress || 0, icon: ActivityIcon }, { label: 'Resolved', value: counts?.resolved || 0, icon: CheckCircle2 }].map(({ label, value, icon: Icon }) => <article className="panel metric" key={label}><div className="metric-label">{label}</div><Icon className="metric-icon" size={17} /><div className="metric-value">{value}</div></article>)}</div>
      <section className="panel"><div className="panel-head"><div><h2>{staff ? 'Active support requests' : 'Recent requests'}</h2><p className="subheading">{staff ? 'The live queue shared with your campus community.' : 'The latest activity from your support queue.'}</p></div></div>
        <div className="ticket-filters"><div className="ticket-search"><Search size={15} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets" aria-label="Search tickets" data-testid="input-search-tickets" /></div><select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketStatus | '')} aria-label="Filter by status" data-testid="filter-ticket-status"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select><select className="select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as TicketPriority | '')} aria-label="Filter by priority" data-testid="filter-ticket-priority"><option value="">All priorities</option>{priorities.map((priority) => <option key={priority} value={priority}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</option>)}</select></div>
        {tickets.isLoading ? <div style={{ padding: 20 }}><LoadingPanel /></div> : tickets.isError ? <div style={{ padding: 20 }}><ErrorPanel message={errorText(tickets.error)} retry={() => tickets.refetch()} /></div> : <TicketRows tickets={tickets.data || []} />}
      </section>
    </>}</div>;
}
function CreateTicket() {
  const [, setLocation] = useLocation(); const client = useQueryClient();
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [category, setCategory] = useState(''); const [priority, setPriority] = useState<TicketPriority>('MEDIUM'); const [error, setError] = useState('');
  const create = useCreateTicket({ mutation: { onSuccess: async (ticket) => { await Promise.all([client.invalidateQueries({ queryKey: getListTicketsQueryKey() }), client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }), client.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() })]); setLocation(`/tickets/${ticket.id}`); } } });
  const submit = (event: FormEvent) => { event.preventDefault(); setError(''); if (title.trim().length < 5) return setError('Give your request a title of at least 5 characters.'); if (description.trim().length < 10) return setError('Add a little more detail (at least 10 characters).'); if (!category) return setError('Choose the category that best fits.'); create.mutate({ data: { title: title.trim(), description: description.trim(), category, priority } }, { onError: (err) => setError(errorText(err)) }); };
  return <div className="content"><PageHeading kicker="Support request" title="What can we help with?" description="Share the details and your campus support team will take it from here." /><div className="grid-two"><section className="panel" style={{ padding: 24 }}><form onSubmit={submit}>
    {error && <div className="notice" role="alert">{error}</div>}
    <div className="field"><label htmlFor="ticket-title">Request title</label><input className="input" id="ticket-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="A short summary of the issue" data-testid="input-ticket-title" /></div>
    <div className="field"><label htmlFor="ticket-category">Category</label><select className="select" id="ticket-category" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-ticket-category"><option value="">Choose a category</option>{categories.map((value) => <option value={value} key={value}>{value}</option>)}</select></div>
    <div className="field"><label htmlFor="ticket-priority">Priority</label><select className="select" id="ticket-priority" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} data-testid="select-ticket-priority">{priorities.map((value) => <option value={value} key={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}</select></div>
    <div className="field"><label htmlFor="ticket-description">Tell us more</label><textarea className="textarea" id="ticket-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} placeholder="What happened? What were you trying to do? Include anything that might help us solve it." data-testid="input-ticket-description" /><div className="muted-small" style={{ textAlign: 'right' }}>{description.length} / 5000</div></div>
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><Link href="/dashboard" className="button">Cancel</Link><button className="button button-primary" disabled={create.isPending} data-testid="button-submit-ticket">{create.isPending ? 'Creating ticket…' : 'Create Ticket'} <ArrowRight size={14} /></button></div>
    </form></section><aside className="panel" style={{ padding: 22, alignSelf: 'start' }}><div className="empty-icon" style={{ margin: '0 0 17px' }}><CircleHelp size={20} /></div><h2>Help us help you</h2><p className="subheading" style={{ lineHeight: 1.7, marginTop: 10 }}>A specific title and a few useful details help your support team get moving sooner. Your request updates will stay together here.</p><div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: 22, paddingTop: 16, display: 'flex', gap: 10, fontSize: 11, lineHeight: 1.5, color: 'hsl(var(--muted-foreground))' }}><ShieldCheck size={15} color="#6a59ce" />Your request is visible to your campus support team.</div></aside></div></div>;
}
function TicketDetailsPage() {
  const params = useParams<{ id: string }>(); const id = Number(params.id); const valid = Number.isInteger(id) && id > 0;
  const detail = useGetTicket(valid ? id : 0, { query: { enabled: valid, queryKey: getGetTicketQueryKey(valid ? id : 0) } });
  const current = useGetCurrentUser(); const agents = useListAgents({ query: { enabled: current.data?.role === 'ADMIN' || current.data?.role === 'AGENT', queryKey: getListAgentsQueryKey() } });
  const client = useQueryClient(); const [body, setBody] = useState(''); const [error, setError] = useState('');
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: getGetTicketQueryKey(id) }), client.invalidateQueries({ queryKey: getListTicketsQueryKey() }), client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }), client.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() })]); };
  const update = useUpdateTicket({ mutation: { onSuccess: refresh } }); const addComment = useAddTicketComment({ mutation: { onSuccess: async () => { setBody(''); await refresh(); } } });
  if (!valid) return <div className="content"><NotFoundContent /></div>;
  if (detail.isLoading) return <div className="content"><LoadingPanel /></div>;
  if (detail.isError || !detail.data) return <div className="content"><ErrorPanel message={errorText(detail.error)} retry={() => detail.refetch()} /></div>;
  const { ticket, comments } = detail.data; const staff = current.data?.role === 'AGENT' || current.data?.role === 'ADMIN';
  const commentSubmit = (e: FormEvent) => { e.preventDefault(); setError(''); if (!body.trim()) return setError('Write a comment before sending.'); addComment.mutate({ id, data: { body: body.trim() } }, { onError: (err) => setError(errorText(err)) }); };
  const doUpdate = (payload: { status?: TicketStatus; assignedToId?: number | null }) => update.mutate({ id, data: payload }, { onError: (err) => setError(errorText(err)) });
  const steps: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  return <div className="content"><div style={{ marginBottom: 18 }}><Link href="/dashboard" className="button button-quiet" style={{ paddingLeft: 0 }}><ArrowLeft size={14} /> Back to requests</Link></div>
    <PageHeading kicker={`${ticket.ticketNumber} · ${ticket.category}`} title={ticket.title} description={`Submitted by ${ticket.createdByName} on ${niceDate(ticket.createdAt)}.`} />
    {error && <div className="notice" role="alert">{error}</div>}
    <div className="ticket-detail-grid"><div>
      <section className="panel detail-body"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div style={{ display: 'flex', gap: 8 }}><StatusPill status={ticket.status} /><PriorityPill priority={ticket.priority} /></div><span className="muted-small">Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</span></div>
        <div className="progress-track">{steps.map((step, index) => { const currentIndex = steps.indexOf(ticket.status); const cls = index < currentIndex ? 'done' : index === currentIndex ? 'active' : ''; return <div key={step} style={{ display: 'contents' }}><div className={`progress-step ${cls}`}><span className="progress-circle">{index < currentIndex ? <Check size={12} /> : index + 1}</span><span>{labelStatus(step)}</span></div>{index < steps.length - 1 && <div className="progress-line" />}</div>; })}</div>
        <h2>Request details</h2><p className="detail-description">{ticket.description}</p>
      </section>
      <section className="panel" style={{ marginTop: 18 }}><div className="panel-head"><div><h2>Conversation</h2><p className="subheading">{comments.length} {comments.length === 1 ? 'update' : 'updates'} on this request</p></div><MessageSquareText size={17} color="#6b5bd0" /></div><div style={{ padding: '0 22px' }}>{comments.length ? comments.map((comment) => <article className="comment" key={comment.id}><div className="avatar">{initials(comment.authorName)}</div><div style={{ flex: 1 }}><div className="comment-meta">{comment.authorName}<span className="comment-time">{comment.authorRole === 'USER' ? 'Student' : comment.authorRole === 'AGENT' ? 'Support agent' : 'Administrator'} · {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span></div><div className="comment-body">{comment.body}</div></div></article>) : <EmptyPanel title="The conversation starts here" text="Add a note or question to keep everyone up to date." />}</div>
        <form onSubmit={commentSubmit} style={{ borderTop: '1px solid hsl(var(--border))', padding: 18 }}><div className="field" style={{ marginBottom: 10 }}><label htmlFor="comment-body">Add an update</label><textarea id="comment-body" className="textarea" style={{ minHeight: 85 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share an update or ask a follow-up…" data-testid="input-comment" /></div><div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="button button-primary" disabled={addComment.isPending} data-testid="button-add-comment">{addComment.isPending ? 'Posting…' : 'Post update'} <ArrowRight size={13} /></button></div></form>
      </section>
    </div>
    <aside className="panel" style={{ padding: 20, alignSelf: 'start' }}><div className="eyebrow">Request info</div><div style={{ display: 'grid', gap: 17, marginTop: 15 }}><div><div className="muted-small" style={{ marginBottom: 6 }}>Submitted by</div><div style={{ fontSize: 12, fontWeight: 700 }}>{ticket.createdByName}</div></div><div><div className="muted-small" style={{ marginBottom: 6 }}>Assigned to</div><div style={{ fontSize: 12, fontWeight: 700 }}>{ticket.assignedToName || 'Not assigned'}</div></div><div><div className="muted-small" style={{ marginBottom: 6 }}>Created</div><div style={{ fontSize: 12, fontWeight: 700 }}>{niceDate(ticket.createdAt)}</div></div><div><div className="muted-small" style={{ marginBottom: 6 }}>Category</div><div style={{ fontSize: 12, fontWeight: 700 }}>{ticket.category}</div></div></div>
      {staff && <div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: 19, paddingTop: 18 }}><div className="eyebrow">Staff controls</div><div className="field" style={{ marginTop: 13 }}><label htmlFor="ticket-status">Status</label><select className="select" id="ticket-status" value={ticket.status} onChange={(e) => doUpdate({ status: e.target.value as TicketStatus })} disabled={update.isPending} data-testid="select-ticket-status">{statuses.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select></div><div className="field"><label htmlFor="ticket-assignee">Assignment</label><select className="select" id="ticket-assignee" value={ticket.assignedToId ?? ''} onChange={(e) => doUpdate({ assignedToId: e.target.value ? Number(e.target.value) : null })} disabled={update.isPending || agents.isLoading} data-testid="select-ticket-assignee"><option value="">Unassigned</option>{(agents.data || []).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></div></div>}
    </aside></div></div>;
}

function AdminOverview() {
  const analytics = useGetAdminAnalytics(); const activity = useGetRecentActivity();
  const analyticsData = analytics.data!;
  const activityData = activity.data || [];
  return <div className="content"><PageHeading kicker="Campus operations" title="Support at a glance" description="A live read on requests, people, and campus support activity." ><Link href="/admin/users" className="button"><Users size={15} /> Manage users</Link></PageHeading>
    {analytics.isLoading ? <LoadingPanel /> : analytics.isError ? <ErrorPanel message={errorText(analytics.error)} retry={() => analytics.refetch()} /> : <><div className="metric-grid">{[{ label: 'All requests', value: analyticsData.totalTickets, icon: TicketIcon }, { label: 'Open', value: analyticsData.openTickets, icon: Clock3 }, { label: 'In progress', value: analyticsData.inProgressTickets, icon: ActivityIcon }, { label: 'Campus users', value: analyticsData.totalUsers, icon: Users }].map(({ label, value, icon: Icon }) => <article className="panel metric" key={label}><div className="metric-label">{label}</div><Icon className="metric-icon" size={17} /><div className="metric-value">{value}</div></article>)}</div>
      <div className="grid-two"><section className="panel"><div className="panel-head"><div><h2>Requests by status</h2><p className="subheading">Where the work stands right now.</p></div><BarChart3 size={17} color="#6b5bd0" /></div><div style={{ padding: '3px 22px 22px' }}>{analyticsData.byStatus.length ? analyticsData.byStatus.map(({ status, count }) => <div key={status} style={{ marginTop: 17 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 7 }}><span>{labelStatus(status)}</span><span>{count}</span></div><div style={{ height: 7, background: 'hsl(var(--muted))', borderRadius: 9, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, analyticsData.totalTickets ? count / analyticsData.totalTickets * 100 : 0)}%`, height: '100%', background: '#7363d7', borderRadius: 9 }} /></div></div>) : <EmptyPanel title="No request activity yet" text="Status totals appear when campus requests are submitted." />}</div></section>
        <section className="panel"><div className="panel-head"><div><h2>By category</h2><p className="subheading">What students need help with.</p></div><Filter size={16} color="#6b5bd0" /></div><div style={{ padding: '0 20px 18px' }}>{analyticsData.byCategory.length ? analyticsData.byCategory.map((item) => <div key={item.category} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: '1px solid hsl(var(--border))', fontSize: 11 }}><span>{item.category}</span><strong>{item.count}</strong></div>) : <EmptyPanel title="No categories yet" text="Category totals will appear as requests arrive." />}</div></section></div>
      <div className="grid-two" style={{ marginTop: 20 }}><section className="panel"><div className="panel-head"><div><h2>Recent requests</h2><p className="subheading">The newest support conversations.</p></div><Link href="/dashboard" className="button button-quiet">See queue <ArrowRight size={13} /></Link></div><TicketListCompact /></section>
        <section className="panel"><div className="panel-head"><div><h2>Recent activity</h2><p className="subheading">Latest changes in the workspace.</p></div><ActivityIcon size={17} color="#6b5bd0" /></div>{activity.isLoading ? <div style={{ padding: 22 }}><LoadingPanel /></div> : activity.isError ? <div style={{ padding: 20 }}><ErrorPanel message={errorText(activity.error)} retry={() => activity.refetch()} /></div> : activityData.length ? activityData.slice(0, 6).map((item) => <div className="activity-item" key={item.id}><div className="activity-dot" /><div><div className="activity-text"><strong>{item.actorName}</strong> {item.action} <strong>{item.ticketNumber}</strong></div><div className="activity-time">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</div></div></div>) : <EmptyPanel title="All quiet for now" text="Workspace activity will appear here." />}</section></div>
      <div className="muted-small" style={{ marginTop: 14 }}>{analyticsData.totalAgents} support agents active in the workspace</div>
    </>}
  </div>;
}
function TicketListCompact() {
  const tickets = useListTickets();
  return tickets.isLoading ? <div style={{ padding: 18 }}><LoadingPanel /></div> : tickets.isError ? <div style={{ padding: 18 }}><ErrorPanel message={errorText(tickets.error)} retry={() => tickets.refetch()} /></div> : <TicketRows tickets={(tickets.data || []).slice(0, 5)} />;
}
function UserManagement() {
  const users = useListUsers(); const client = useQueryClient(); const updateRole = useUpdateUserRole(); const [error, setError] = useState(''); const [filter, setFilter] = useState('');
  const update = (user: User, role: UserRole) => { setError(''); updateRole.mutate({ id: user.id, data: { role } }, { onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: getListUsersQueryKey() }), client.invalidateQueries({ queryKey: getListAgentsQueryKey() }), client.invalidateQueries({ queryKey: getGetAdminAnalyticsQueryKey() })]); }, onError: (err) => setError(errorText(err)) }); };
  const filtered = useMemo(() => (users.data || []).filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(filter.toLowerCase())), [users.data, filter]);
  return <div className="content"><PageHeading kicker="Workspace access" title="People & roles" description="Manage who can use SupportFlow and what they can do." ><span className="pill">{users.data?.length || 0} people</span></PageHeading>
    <div className="panel"><div className="panel-head"><div><h2>Campus users</h2><p className="subheading">Role changes apply to the account immediately.</p></div><div style={{ position: 'relative', width: 220 }}><Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: '#85839a' }} /><input className="input" style={{ paddingLeft: 33 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a person…" aria-label="Search users" data-testid="input-search-users" /></div></div>
      {error && <div className="notice" style={{ margin: '0 20px 15px' }} role="alert">{error}</div>}
      {users.isLoading ? <div style={{ padding: 20 }}><LoadingPanel /></div> : users.isError ? <div style={{ padding: 20 }}><ErrorPanel message={errorText(users.error)} retry={() => users.refetch()} /></div> : filtered.length ? <><div className="table-labels" style={{ gridTemplateColumns: 'minmax(180px,1.2fr) minmax(150px,1fr) 115px 125px' }}><span>Person</span><span>Email</span><span>Joined</span><span>Role</span></div>{filtered.map((user) => <div className="user-row" key={user.id} data-testid={`row-user-${user.id}`}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="avatar">{initials(user.name)}</div><div><div style={{ fontSize: 12, fontWeight: 700 }}>{user.name}</div><div className="muted-small">ID {user.id}</div></div></div><div className="muted-small">{user.email}</div><div className="muted-small">{niceDate(user.createdAt)}</div><select className="select" style={{ padding: '8px 9px', fontSize: 11 }} value={user.role} onChange={(e) => update(user, e.target.value as UserRole)} disabled={updateRole.isPending} aria-label={`Role for ${user.name}`} data-testid={`select-user-role-${user.id}`}><option value="USER">Student</option><option value="AGENT">Support agent</option><option value="ADMIN">Administrator</option></select></div>)}</> : <EmptyPanel title="No matching people" text={filter ? 'Try a different name, email, or role.' : 'Accounts will appear here when people join.'} />}
    </div></div>;
}
function NotFoundContent() { const [location] = useLocation(); return <div className="panel empty-state" style={{ maxWidth: 560, margin: '50px auto' }}><div className="empty-icon"><Search size={21} /></div><div className="eyebrow">404 · Page not found</div><h2>We couldn’t find that page</h2><p>The address <strong>{location}</strong> doesn’t lead to a SupportFlow page.</p><Link href="/dashboard" className="button button-primary">Back to workspace</Link></div>; }
function NotFound() { return <NotFoundContent />; }
function RouteFrame() {
  return <Switch>
    <Route path="/" component={Landing} />
    <Route path="/login" component={Login} />
    <Route path="/register" component={Register} />
    <Route path="/dashboard">{() => <Protected>{(user) => <Dashboard user={user} />}</Protected>}</Route>
    <Route path="/tickets/create">{() => <Protected roles={['USER', 'AGENT', 'ADMIN']}>{() => <CreateTicket />}</Protected>}</Route>
    <Route path="/tickets/:id">{() => <Protected>{() => <TicketDetailsPage />}</Protected>}</Route>
    <Route path="/admin">{() => <Protected roles={['ADMIN']}>{() => <AdminOverview />}</Protected>}</Route>
    <Route path="/admin/users">{() => <Protected roles={['ADMIN']}>{() => <UserManagement />}</Protected>}</Route>
    <Route component={NotFound} />
  </Switch>;
}
function Router() { return <ErrorBoundary><RouteFrame /></ErrorBoundary>; }
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
