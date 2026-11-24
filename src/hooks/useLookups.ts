import { useState, useEffect } from 'react';
import { LookupData } from '../types.js';
import { api, Region } from '../lib/ophea-api-client.js';
import { fallbackLookups } from '../data/fallbackContent.js';

export const useLookups = () => {
  const [lookups, setLookups] = useState<LookupData>(fallbackLookups);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      api.getRegions(),
      api.getGraduationLevels(),
      api.getFieldsOfStudy(),
      api.getSectors(),
    ])
      .then(([regionsResult, graduationResult, fieldsResult, sectorsResult]) => {
        if (!mounted) return;

        const toLookupItem = (value: unknown, index: number) => {
          if (!value || typeof value !== 'object') return null;
          const item = value as Record<string, unknown>;
          const id = typeof item.id === 'string' ? item.id : typeof item.code === 'string' ? item.code : `lookup-${index}`;
          const code = typeof item.code === 'string' ? item.code : id;
          const rawLabel = item.label;
          const label = rawLabel && typeof rawLabel === 'object'
            ? rawLabel as Record<string, unknown>
            : undefined;
          const name = typeof rawLabel === 'string'
            ? rawLabel
            : typeof item.name === 'string'
              ? item.name
              : typeof item.localizedLabel === 'string'
                ? item.localizedLabel
                : code;

          return {
            id,
            code,
            label: {
              en: typeof label?.en === 'string' ? label.en : name,
              om: typeof label?.om === 'string' ? label.om : name,
              am: typeof label?.am === 'string' ? label.am : name,
              ar: typeof label?.ar === 'string' ? label.ar : name,
              fr: typeof label?.fr === 'string' ? label.fr : name,
            },
          };
        };

        const regions = regionsResult.status === 'fulfilled' && Array.isArray(regionsResult.value)
          ? regionsResult.value
          : [];
        const graduationLevels = graduationResult.status === 'fulfilled' && Array.isArray(graduationResult.value)
          ? graduationResult.value.map(toLookupItem).filter((item): item is NonNullable<typeof item> => item !== null)
          : [];
        const fieldsOfStudy = fieldsResult.status === 'fulfilled' && Array.isArray(fieldsResult.value)
          ? fieldsResult.value.map(toLookupItem).filter((item): item is NonNullable<typeof item> => item !== null)
          : [];

        const sectors = sectorsResult.status === 'fulfilled' && Array.isArray(sectorsResult.value)
          ? sectorsResult.value.map(toLookupItem).filter((item): item is NonNullable<typeof item> => item !== null)
          : [];

        setLookups({
          ...fallbackLookups,
          regions: regions.length
            ? regions.map((region: Region, index) => {
                const fallbackName = region?.id || `Region ${index + 1}`;
                const rawName = region?.name;
                const localizedName = typeof rawName === 'string'
                  ? { en: rawName, om: rawName, am: rawName, ar: rawName, fr: rawName }
                  : {
                      en: rawName?.en || rawName?.om || rawName?.am || fallbackName,
                      om: rawName?.om || rawName?.en || fallbackName,
                      am: rawName?.am || rawName?.en || fallbackName,
                      ar: rawName?.ar || rawName?.en || fallbackName,
                      fr: rawName?.fr || rawName?.en || fallbackName,
                    };
                return {
                  id: region?.id || `region-${index}`,
                  code: region?.id || `region-${index}`,
                  label: localizedName,
                };
              })
            : fallbackLookups.regions,
          graduationLevels: graduationLevels.length ? graduationLevels : fallbackLookups.graduationLevels,
          fieldsOfStudy: fieldsOfStudy.length ? fieldsOfStudy : fallbackLookups.fieldsOfStudy,
          sectors: sectors.length ? sectors : fallbackLookups.sectors,
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { lookups, loading };
};
