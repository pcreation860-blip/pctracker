import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-d1b2a30f`;

const DEFAULT_PARTY_NAMES = [
  'AA',
  'AT',
  'DF',
  'FS',
  'GC',
  'GP',
  'JB',
  'JST',
  'KE',
  'KP',
  'LV',
  'MM',
  'R',
  'RD',
  'RL',
  'S',
  'SV',
  'VE',
].sort(); // Ensure alphabetical order

export function usePartyNames() {
  const [partyNames, setPartyNames] = useState<string[]>(DEFAULT_PARTY_NAMES);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPartyNames();
  }, []);

  const loadPartyNames = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/get-party-names`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Loaded party names from server:', data);
        if (data.partyNames && data.partyNames.length > 0) {
          setPartyNames(data.partyNames);
        } else {
          // Use defaults if empty and initialize in backend
          console.log('No party names found, initializing with defaults');
          setPartyNames(DEFAULT_PARTY_NAMES);
          // Initialize in backend (don't wait)
          fetch(`${API_URL}/save-party-names`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ partyNames: DEFAULT_PARTY_NAMES }),
          }).catch(err => console.error('Error initializing party names:', err));
        }
      } else {
        console.warn('Failed to fetch party names, using defaults');
        setPartyNames(DEFAULT_PARTY_NAMES);
      }
    } catch (error) {
      console.error('Error loading party names:', error);
      // Always fall back to defaults
      setPartyNames(DEFAULT_PARTY_NAMES);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPartyNames = () => {
    loadPartyNames();
  };

  return { partyNames, isLoading, refreshPartyNames };
}
