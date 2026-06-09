import { useEffect, useState } from 'react';
import { supabase } from './db';
import type { SkillRatingOption } from '../types/form';

const FALLBACK: SkillRatingOption[] = [
  { sort_order: 1, label: '1 — Only Training / Certification' },
  { sort_order: 2, label: '2 — Basic Work Knowledge' },
  { sort_order: 3, label: '3 — Intermediate' },
  { sort_order: 4, label: '4 — Proficient' },
  { sort_order: 5, label: '5 — Expert' },
];

export function useSkillRatings() {
  const [ratings, setRatings] = useState<SkillRatingOption[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('settings_skill_ratings')
      .select('sort_order, label')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) setRatings(data as SkillRatingOption[]);
        setLoading(false);
      });
  }, []);

  return { ratings, loading };
}
