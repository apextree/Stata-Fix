# StataFix Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      StataFix Frontend                       │
│                       (React + Vite)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase Client
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                          │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ profiles │  │  stata_  │  │ comments │  │  point_  │    │
│  │          │  │  issues  │  │          │  │  ledger  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│       │             │              │              │          │
│       └─────────────┴──────────────┴──────────────┘          │
│                  PostgreSQL Database                         │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Diagrams

### 1. User Registration Flow
```
User Input (username + password)
    │
    ▼
Hash Password (SHA-256)
    │
    ▼
Insert into profiles
    ├─ username
    ├─ password_hash
    └─ cumulative_points = 0
    │
    ▼
Store user in localStorage
    │
    ▼
Navigate to Home
```

### 2. Create STATA Issue Flow
```
User submits form
    │
    ▼
Insert into stata_issues
    ├─ user_id
    ├─ command
    ├─ error_category
    ├─ description
    └─ is_resolved = false
    │
    ▼
Insert into point_ledger (+5 points)
    ├─ user_id
    ├─ points_change = 5
    └─ reason = 'POST_ERROR'
    │
    ▼
Update profiles.cumulative_points
    │
    ▼
Navigate to Browse Issues
```

### 3. Add Comment Flow
```
User submits comment
    │
    ▼
Insert into comments
    ├─ issue_id
    ├─ user_id
    ├─ comment_text
    └─ is_verified_fix = false
    │
    ▼
Insert into point_ledger (+3 points)
    ├─ user_id
    ├─ points_change = 3
    └─ reason = 'SUGGESTION'
    │
    ▼
Update profiles.cumulative_points
    │
    ▼
Refresh comments list
```

### 4. Mark as Fix Flow
```
Issue author clicks "Mark as The Fix"
    │
    ▼
Update comment
    └─ is_verified_fix = true
    │
    ▼
Update stata_issue
    └─ is_resolved = true
    │
    ▼
Insert into point_ledger (+5 points to commenter)
    ├─ user_id = comment.user_id
    ├─ points_change = 5
    └─ reason = 'ACCEPTED_FIX'
    │
    ▼
Update commenter's profile.cumulative_points
    │
    ▼
Refresh issue and comments
```

## 🗃️ Database Relationships

```
profiles (1) ───< stata_issues (Many)
    │
    └───────< comments (Many)
    │
    └───────< point_ledger (Many)

stata_issues (1) ───< comments (Many)
```

### Foreign Keys
- `stata_issues.user_id` → `profiles.id`
- `comments.user_id` → `profiles.id`
- `comments.issue_id` → `stata_issues.id`
- `point_ledger.user_id` → `profiles.id`

### Cascade Behavior
- Delete profile → Deletes all issues, comments, and point ledger entries
- Delete issue → Deletes all associated comments

## 🔐 Authentication Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. Submit username + password
     ▼
┌──────────────┐
│ AuthContext  │ 2. Hash password (SHA-256)
└────┬─────────┘
     │
     │ 3. Query profiles table
     ▼
┌──────────────┐
│   Supabase   │ 4. Match username + password_hash
└────┬─────────┘
     │
     │ 5. Return user data
     ▼
┌──────────────┐
│ AuthContext  │ 6. Set user state
└────┬─────────┘
     │
     │ 7. Store in localStorage
     ▼
┌──────────────┐
│    Client    │ 8. Navigate to protected route
└──────────────┘
```

## 📊 Component Hierarchy

```
App
├── ThemeProvider
│   └── AuthProvider
│       ├── ThemeToggle
│       ├── Sidebar
│       │   ├── Navigation Links
│       │   ├── User Info (username + points)
│       │   └── Logout Button
│       └── Routes
│           ├── Home
│           ├── Login
│           ├── Register
│           └── ProtectedRoutes
│               ├── SeePolipions (Browse)
│               │   └── Card (multiple)
│               ├── MyPolipions
│               │   └── Card (multiple)
│               ├── CreatePolipion (Report Error)
│               ├── EditPolipion
│               ├── PolipionDetails
│               │   ├── Issue Info
│               │   └── Comments List
│               │       ├── Comment (multiple)
│               │       └── "Mark as Fix" Button
│               └── Leaderboard
│                   └── User Rankings Table
```

## 🎮 Gamification Logic

### Point Calculation
```javascript
User Total Points = SUM(point_ledger.points_change WHERE user_id = user.id)

// Also stored redundantly in:
profiles.cumulative_points
```

### Leaderboard Ranking
```sql
SELECT 
  username, 
  cumulative_points,
  ROW_NUMBER() OVER (ORDER BY cumulative_points DESC) as rank
FROM profiles
ORDER BY cumulative_points DESC
LIMIT 50;
```

### Issue Resolution Status
```
Issue is Resolved = stata_issues.is_resolved == true

Verified Fix Exists = 
  EXISTS (
    SELECT 1 FROM comments 
    WHERE issue_id = issue.id 
    AND is_verified_fix = true
  )
```

## 🔍 Search Implementation

### Search Strategy
```javascript
// Search both command and description fields
supabase
  .from('stata_issues')
  .select('*')
  .or(`command.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
```

### Sort Options
1. **Newest First**: `ORDER BY created_at DESC`
2. **Unresolved First**: `ORDER BY is_resolved ASC, created_at DESC`

## 🎨 Theme System

### Theme Context
```javascript
ThemeContext
├── currentTheme (light | dark)
├── toggleTheme()
└── Provides CSS variables to all components
```

### CSS Variable System
```css
/* All components use CSS variables */
color: var(--text-color);
background: var(--bg-color);
border: 1px solid var(--border-color);

/* Variables change based on [data-theme] attribute */
[data-theme="light"] { --text-color: #1e293b; }
[data-theme="dark"]  { --text-color: #f1f5f9; }
```

## 🛡️ Security Considerations

### Current Implementation (Pseudo-Auth)
```
❌ Password hashed client-side only
❌ No server-side validation
❌ Direct database access from client
⚠️ Suitable for development/demo only
```

### Production Recommendations
```
✅ Use Supabase Auth
✅ Server-side password hashing
✅ Row Level Security (RLS)
✅ API rate limiting
✅ Input sanitization
✅ HTTPS only
```

## 📈 Scalability Notes

### Current Limitations
- No pagination (fetches all records)
- No caching
- No real-time updates
- Points calculated client-side

### Recommended Improvements
```
1. Pagination
   - Add limit/offset to queries
   - Implement infinite scroll

2. Caching
   - Use React Query or SWR
   - Cache leaderboard data

3. Real-time
   - Add Supabase subscriptions
   - Live comment updates

4. Server-side Logic
   - Use Supabase Edge Functions
   - Validate points server-side
   - Use database triggers
```

## 🔧 Development vs Production

### Development Setup
```bash
# .env.local
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key

npm run dev
```

### Production Build
```bash
npm run build
npm run preview

# Deploy to:
# - Vercel
# - Netlify  
# - GitHub Pages
```

## 📱 Responsive Design

```
Desktop (>768px)
├── Sidebar: Fixed left navigation
└── Main Content: Full width with margins

Mobile (<768px)
├── Sidebar: Collapsible hamburger menu
└── Main Content: Full width, stacked layout
```

## 🎯 Performance Optimization

### Current Strategy
- Vite for fast builds
- React lazy loading (not implemented)
- CSS variables for theme switching
- Debounced search input (300ms)

### Future Enhancements
- Code splitting by route
- Image lazy loading
- Virtual scrolling for long lists
- Service worker for offline support
