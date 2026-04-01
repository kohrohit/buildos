# React / Next.js Standards

Language-specific engineering standards for React and Next.js projects.

## Design Standards

### Project Structure (Next.js App Router)
```
src/
  ├── app/
  │   ├── (auth)/                # Route group for auth pages
  │   │   ├── login/page.tsx
  │   │   └── register/page.tsx
  │   ├── dashboard/
  │   │   ├── page.tsx           # Server component by default
  │   │   ├── loading.tsx        # Loading UI
  │   │   ├── error.tsx          # Error boundary
  │   │   └── layout.tsx         # Nested layout
  │   ├── api/                   # Route handlers
  │   ├── layout.tsx             # Root layout
  │   └── globals.css
  ├── components/
  │   ├── ui/                    # Generic UI primitives (Button, Input, Modal)
  │   └── features/              # Feature-specific composed components
  ├── hooks/                     # Custom React hooks
  ├── lib/                       # Utility functions, API clients
  ├── stores/                    # State management (Zustand, Jotai)
  ├── types/                     # Shared TypeScript types
  └── __tests__/
```

### Component Architecture
- Default to Server Components; use `'use client'` only when needed
- Keep components small (< 150 lines including JSX) (SRP)
- Separate data fetching from presentation (SRP)
- Use composition over prop drilling (React Context, compound components) (DIP)
- Collocate related files: component, styles, tests, stories
- One exported component per file — each component has one responsibility (SRP)
- Extract hooks for reusable behavior; keep components focused on rendering (SRP)
- Use render props, HOCs, or composition for behavior variants instead of conditionals (OCP)
- Props interfaces should be focused per use case, not monolithic (ISP)
- Custom hooks depend on abstractions (API clients as interfaces), not concrete implementations (DIP)

### State Management Rules
- URL state for shareable/bookmarkable state (search params, filters)
- Server state with React Query / SWR (API data with caching)
- Local state with `useState` for component-scoped UI state
- Global client state with Zustand or Jotai (only when truly needed)
- Form state with React Hook Form + Zod validation
- Never duplicate server state in client state stores

## Naming Conventions

### Files
- Components: `PascalCase.tsx` (`UserProfile.tsx`, `OrderList.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (`useAuth.ts`, `useDebounce.ts`)
- Utilities: `kebab-case.ts` (`format-date.ts`, `api-client.ts`)
- Types: `kebab-case.ts` (`user.types.ts`, `order.types.ts`)
- Test files: `ComponentName.test.tsx` co-located with source

### Components and Props
- Components: `PascalCase` (`UserProfile`, `OrderSummary`)
- Props interfaces: `ComponentNameProps` (`UserProfileProps`, `ButtonProps`)
- Event handlers: `onAction` in props, `handleAction` in implementation
- Boolean props: `isLoading`, `hasError`, `canSubmit` (no `loading={true}`)
- Render props / children patterns: type explicitly with `ReactNode`

### Hooks
- Always prefix with `use`: `useAuth`, `useLocalStorage`, `useMediaQuery`
- Return typed objects or tuples: `const { data, isLoading } = useUsers()`
- Name state setters with `set` prefix: `const [count, setCount] = useState(0)`

## Test Expectations

### Framework and Tools
- Use `vitest` with `@testing-library/react` for component tests
- Use `@testing-library/user-event` for user interaction simulation
- Use `msw` (Mock Service Worker) for API mocking
- Use Playwright or Cypress for E2E tests

### Testing Philosophy
- Test behavior, not implementation details
- Query elements by role, label, or text (not by class or test-id unless necessary)
- Test what the user sees and does, not internal component state
- Avoid testing implementation details (state values, method calls)

### Test Structure
```typescript
describe('LoginForm', () => {
  it('should display validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={mockSubmit} />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit with credentials when form is valid', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'user@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockSubmit).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });
  });
});
```

## Security Constraints

### XSS Prevention
- Never use `dangerouslySetInnerHTML` unless content is sanitized with DOMPurify
- Sanitize user-generated content before rendering
- Use Content Security Policy headers in Next.js middleware
- Escape dynamic values in `href` attributes (prevent `javascript:` URLs)

### Authentication
- Store tokens in httpOnly cookies (not localStorage or sessionStorage)
- Implement CSRF protection for cookie-based auth
- Use Next.js middleware for route-level access control
- Redirect unauthenticated users server-side (not client-side flash)

### Data Handling
- Validate all form inputs with Zod schemas before submission
- Never expose API keys or secrets in client-side code
- Use environment variables with `NEXT_PUBLIC_` prefix only for public values
- Implement rate limiting on API routes

## Performance Expectations

### Core Web Vitals Targets
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
- TTFB (Time to First Byte): < 800ms

### Rendering Optimization
- Use Server Components by default; minimize client-side JavaScript
- Lazy load components below the fold with `React.lazy` or `next/dynamic`
- Use `next/image` for all images (automatic optimization, lazy loading)
- Implement `loading.tsx` for Suspense boundaries in Next.js
- Memoize expensive computations with `useMemo` (only when profiled)
- Use `React.memo` only for components that re-render with same props frequently

### Data Fetching
- Fetch data in Server Components when possible (zero client JS)
- Use React Query or SWR for client-side data with stale-while-revalidate
- Implement optimistic updates for mutations
- Prefetch data on hover/focus for navigation targets
- Use `next/link` for client-side navigation with prefetching

### Bundle Size
- Analyze bundle with `@next/bundle-analyzer`
- Tree-shake unused code; prefer libraries that support it
- Use dynamic imports for heavy libraries (charts, editors, maps)
- Set performance budgets: < 200KB initial JS (compressed)

## Anti-Patterns

### React Anti-Patterns
- **Prop drilling**: More than 3 levels deep -- use Context or composition
- **useEffect for derived state**: Compute during render, not in effects
- **useEffect as event handler**: Use event handlers for user actions, not effects
- **State for derived values**: Compute from existing state, do not duplicate
- **Index as key**: Never use array index as key for dynamic lists
- **Premature optimization**: Do not `useMemo`/`useCallback` everything; profile first

### Next.js Anti-Patterns
- Using `'use client'` at the top of every component
- Fetching data on the client when server fetch is possible
- Not using `loading.tsx` and `error.tsx` for route segments
- Importing server-only code in client components
- Using `useEffect` for data fetching instead of server components or React Query
- Not implementing proper error boundaries

### Component Anti-Patterns
- Components over 200 lines (split into smaller components)
- Mixing concerns (data fetching + rendering + state management in one component)
- Unnecessary wrapper components that only pass props through
- Inline styles for anything beyond truly dynamic values
- Hard-coding text strings (use constants or i18n)

## Review Checklist

- [ ] Server Components used by default; `'use client'` only where necessary
- [ ] Components are small, focused, and composable
- [ ] All forms validated with Zod + React Hook Form
- [ ] Images use `next/image` with proper sizing
- [ ] No `any` types or type assertions
- [ ] Tests verify user behavior with Testing Library
- [ ] No sensitive data in client-side code
- [ ] Loading and error states handled for all async operations
- [ ] Accessibility: semantic HTML, ARIA labels, keyboard navigation
- [ ] Bundle size within performance budget
- [ ] Core Web Vitals meet targets
- [ ] ESLint + Next.js lint rules pass with zero warnings
