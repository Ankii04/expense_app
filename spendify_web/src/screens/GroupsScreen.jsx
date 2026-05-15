import React from 'react';
import { useGroups } from '../hooks/useExpenses';
import { Users, UserPlus } from 'lucide-react';

export default function GroupsScreen() {
  const { groups } = useGroups();

  return (
    <div className="fade-in">
      <div className="flex-row justify-between" style={{ marginBottom: '24px' }}>
        <h1>Groups</h1>
        <button className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <UserPlus size={20} />
        </button>
      </div>

      <div className="flex-col gap-md">
        {groups.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <Users size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
            <p style={{ color: 'var(--text-muted)' }}>No groups yet. Create one to split bills!</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="card">
              <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
                <h3>{group.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{group.members.length} members</p>
              </div>
              <div style={{ height: '4px', background: 'var(--elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: '30%', height: '100%', background: 'var(--accent)' }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
