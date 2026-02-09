import { useState, useEffect } from "react";
import { supabase } from "../client";
import "./Leaderboard.css";

const Leaderboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, cumulative_points")
        .order("cumulative_points", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching leaderboard:", error);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Loading leaderboard...</h2>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h1>🏆 StataFix Leaderboard</h1>
        <p className="leaderboard-subtitle">
          Top contributors helping solve STATA errors
        </p>
      </div>

      <div className="points-guide">
        <h3>How to Earn Points:</h3>
        <ul>
          <li>📝 Post an error: +5 points</li>
          <li>💡 Suggest a solution: +3 points</li>
          <li>✓ Solution accepted as fix: +5 points</li>
        </ul>
      </div>

      <div className="leaderboard-table-wrapper">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Username</th>
              <th>Total Points</th>
            </tr>
          </thead>
          <tbody>
            {users && users.length > 0 ? (
              users.map((user, index) => (
                <tr 
                  key={user.id} 
                  className={index < 3 ? `top-${index + 1}` : ''}
                >
                  <td className="rank-cell">
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                    {index > 2 && `#${index + 1}`}
                  </td>
                  <td className="username-cell">@{user.username}</td>
                  <td className="points-cell">{user.cumulative_points || 0}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                  No users yet. Be the first to contribute!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;
