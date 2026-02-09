# StataFix Quick Reference Card

## 🗄️ Database Tables

### profiles
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| username | TEXT | Unique username |
| password_hash | TEXT | Hashed password |
| cumulative_points | BIGINT | Total points earned |
| created_at | TIMESTAMPTZ | Account creation time |

### stata_issues
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to profiles |
| username | TEXT | Author username |
| command | TEXT | STATA command (e.g., "regress") |
| error_category | TEXT | Error type |
| description | TEXT | Error description |
| image_url | TEXT | Screenshot URL (optional) |
| is_resolved | BOOLEAN | Whether issue is solved |
| created_at | TIMESTAMPTZ | Issue creation time |

### comments
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| issue_id | UUID | FK to stata_issues |
| user_id | UUID | FK to profiles |
| username | TEXT | Commenter username |
| comment_text | TEXT | Solution/suggestion text |
| is_verified_fix | BOOLEAN | Marked as "The Fix" |
| created_at | TIMESTAMPTZ | Comment creation time |

### point_ledger
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to profiles |
| points_change | INTEGER | Points added/subtracted |
| reason | TEXT | 'POST_ERROR', 'SUGGESTION', 'ACCEPTED_FIX' |
| created_at | TIMESTAMPTZ | Transaction time |

## 🎮 Points System

| Action | Points | Reason Code |
|--------|--------|-------------|
| Post an error | +5 | POST_ERROR |
| Suggest a solution | +3 | SUGGESTION |
| Solution marked as fix | +5 | ACCEPTED_FIX |

## 🎨 Error Categories

- Syntax Error
- Data Error
- Variable Not Found
- Type Mismatch
- Memory Error
- File I/O Error
- Logic Error
- Other

## 🎯 Color Palette

### Light Mode
```css
--accent-indigo: #4f46e5
--accent-slate: #1e293b
--bg-color: #f9fafb
--text-color: #1e293b
```

### Dark Mode
```css
--accent-indigo: #6366f1
--accent-slate: #f1f5f9
--bg-color: #0f172a
--text-color: #f1f5f9
```

## 🛣️ Routes

| Path | Component | Access |
|------|-----------|--------|
| `/` | Home | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/polipions` | Browse Issues | Protected |
| `/my-polipions` | My Issues | Protected |
| `/new` | Report Error | Protected |
| `/polipion/:id` | Issue Details | Protected |
| `/edit/:id` | Edit Issue | Protected |
| `/leaderboard` | Leaderboard | Protected |

## 🔑 LocalStorage Keys

- `statafix_user` - Current logged-in user object
- `theme` - Current theme (light/dark)

## 🎨 Icons

| Feature | Icon |
|---------|------|
| Command | 💻 |
| Statistics | 📊 |
| Search | 🔍 |
| Analytics | 📈 |
| Points | ⭐ |
| Leaderboard | 🏆 |
| Verified Fix | ✓ |
| Resolved | ✓ |
| Home | 🏠 |
| Edit | ✏️ |
| Delete | 🗑️ |

## 🔧 Supabase Client

Location: `src/client.js`
```javascript
import { supabase } from '../client';

// Query example
const { data, error } = await supabase
  .from('stata_issues')
  .select('*')
  .eq('is_resolved', false);
```

## 📝 Common Queries

### Fetch user with points
```javascript
const { data } = await supabase
  .from('profiles')
  .select('id, username, cumulative_points')
  .eq('username', username)
  .single();
```

### Fetch issue with comments
```javascript
// Get issue
const { data: issue } = await supabase
  .from('stata_issues')
  .select('*')
  .eq('id', issueId)
  .single();

// Get comments
const { data: comments } = await supabase
  .from('comments')
  .select('*')
  .eq('issue_id', issueId)
  .order('created_at', { ascending: true });
```

### Add points
```javascript
// Insert to ledger
await supabase
  .from('point_ledger')
  .insert({
    user_id: userId,
    points_change: 5,
    reason: 'POST_ERROR'
  });

// Update profile
await supabase
  .from('profiles')
  .update({ cumulative_points: newTotal })
  .eq('id', userId);
```

## 🚨 Common Issues

### Points not updating?
- Check if both `point_ledger` insert AND `profiles` update succeed
- Refresh page to see updated points in sidebar

### Comments not showing?
- Verify `issue_id` matches in both queries
- Check if comments table has proper foreign key

### Search not working?
- Uses `.or()` operator for command AND description
- Requires exact ilike syntax: `ilike.%term%`

### Can't mark as fix?
- Only issue author can mark comments
- Issue must not already be resolved
- Comment must not already be marked as fix

## 📦 File Structure

```
src/
├── client.js              # Supabase client
├── App.jsx               # Main app with routes
├── context/
│   ├── AuthContext.jsx   # Auth state management
│   └── ThemeContext.jsx  # Theme state management
├── components/
│   ├── card.jsx          # Issue card component
│   ├── Sidebar.jsx       # Navigation sidebar
│   └── ProtectedRoute.jsx # Route guard
├── pages/
│   ├── Home.jsx          # Landing page
│   ├── Login.jsx         # Login page
│   ├── Register.jsx      # Register page
│   ├── SeePolipions.jsx  # Browse issues
│   ├── MyPolipions.jsx   # User's issues
│   ├── CreatePolipion.jsx # Create issue
│   ├── EditPolipion.jsx  # Edit issue
│   ├── PolipionDetails.jsx # Issue details
│   └── Leaderboard.jsx   # Leaderboard
└── styles/
    └── theme.css         # Color variables
```

## 🔍 Debugging Tips

1. **Check Supabase logs** in dashboard for query errors
2. **Browser console** for JavaScript errors
3. **Network tab** to see API calls
4. **React DevTools** to inspect component state
5. **LocalStorage** to verify user object

## 📊 Analytics Queries

### Top contributors
```sql
SELECT username, cumulative_points
FROM profiles
ORDER BY cumulative_points DESC
LIMIT 10;
```

### Points breakdown by reason
```sql
SELECT reason, SUM(points_change) as total_points
FROM point_ledger
GROUP BY reason;
```

### Most active users
```sql
SELECT p.username, 
  COUNT(DISTINCT si.id) as issues,
  COUNT(DISTINCT c.id) as comments
FROM profiles p
LEFT JOIN stata_issues si ON si.user_id = p.id
LEFT JOIN comments c ON c.user_id = p.id
GROUP BY p.username
ORDER BY (COUNT(DISTINCT si.id) + COUNT(DISTINCT c.id)) DESC;
```
