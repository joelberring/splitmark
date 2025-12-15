# Contributing to OrienteerPro

First off, thank you for considering contributing to OrienteerPro! 🎉

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment** (OS, browser, version)

### Suggesting Features

Feature requests are welcome! Please provide:

- **Clear use case**
- **Expected behavior**
- **Why this would be useful** to most users
- **Possible implementation** if you have ideas

### Pull Requests

1. **Fork the repo** and create your branch from `develop`
2. **Follow code style** (run `npm run lint`)
3. **Add tests** if you're adding functionality
4. **Update documentation** if needed
5. **Ensure tests pass** (`npm test`)
6. **Create a Pull Request**

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/orienteerpro.git
cd orienteerpro

# Install dependencies
npm install

# Copy environment template
cp env.example.txt .env.local

# Start development server
npm run dev
```

## Project Structure

```
orienteerpro/
├── app/                    # Next.js pages
├── components/             # React components
├── lib/                    # Core libraries
│   ├── auth/              # Authentication
│   ├── db/                # Database
│   ├── gps/               # GPS tracking
│   ├── maps/              # Map rendering
│   └── sportident/        # Hardware integration
├── types/                 # TypeScript types
└── public/                # Static assets
```

## Coding Standards

### TypeScript

- Use **TypeScript** for all new files
- Define **proper types** (no `any`)
- Export types for reusability
- Use **interfaces** for objects, **types** for unions

### React Components

- Use **functional components** with hooks
- Keep components **focused** (single responsibility)
- Extract **reusable logic** into hooks
- Use **proper prop types**

### Example:

```typescript
// ✅ Good
interface EventCardProps {
  event: Event;
  onSelect: (id: string) => void;
}

export function EventCard({ event, onSelect }: EventCardProps) {
  return (
    <div onClick={() => onSelect(event.id)}>
      {event.name}
    </div>
  );
}

// ❌ Bad
export function EventCard(props: any) {
  return <div onClick={() => props.onSelect(props.event.id)}>{props.event.name}</div>;
}
```

### File Naming

- **Components:** PascalCase (`EventCard.tsx`)
- **Utilities:** camelCase (`formatTime.ts`)
- **Pages:** kebab-case in route, PascalCase in file (`events/[id]/page.tsx`)
- **Types:** PascalCase (`Event`, `GPSPoint`)

### Git Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Strava integration
fix: resolve GPS accuracy issue
docs: update deployment guide
chore: upgrade dependencies
test: add SportIdent reader tests
```

## Testing

### Writing Tests

```typescript
// __tests__/lib/gps/tracker.test.ts
import { gpsTracker } from '@/lib/gps/tracker';

describe('GPS Tracker', () => {
  it('should start tracking', async () => {
    const trackId = await gpsTracker.startTracking('Test Track');
    expect(trackId).toBeDefined();
  });

  it('should calculate distance correctly', () => {
    const distance = gpsTracker.calculateDistance(
      { lat: 59.33, lng: 18.07 },
      { lat: 59.34, lng: 18.08 }
    );
    expect(distance).toBeGreaterThan(0);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- tracker.test.ts

# Watch mode
npm test -- --watch
```

## Documentation

- Update **README.md** for major features
- Add **code comments** for complex logic
- Update **USER_GUIDE.md** for user-facing features
- Keep **DEPLOYMENT.md** current

## Performance

- Minimize **re-renders** (use `useMemo`, `useCallback`)
- Lazy load **heavy components**
- Optimize **images** (use Next.js Image)
- Avoid **unnecessary dependencies**

## Accessibility

- Use **semantic HTML**
- Include **ARIA labels**
- Ensure **keyboard navigation**
- Test with **screen readers**
- Maintain **color contrast** (WCAG AA)

## Security

- Never commit **API keys** or secrets
- Use **environment variables**
- Sanitize **user input**
- Follow **OWASP** guidelines
- Report **security issues** privately

## Review Process

1. **Automated checks** run on PR
2. **Code review** by maintainers
3. **Testing** in preview environment
4. **Merge** to develop
5. **Release** to main

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- **Discord:** [OrienteerPro Community](https://discord.gg/orienteerpro)
- **Email:** dev@orienteerpro.se
- **Issues:** [GitHub Issues](https://github.com/orienteerpro/orienteerpro/issues)

---

Thank you for contributing! 🙏
