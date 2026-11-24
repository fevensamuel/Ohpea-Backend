/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Building2 } from 'lucide-react';
import { Partner } from '../types.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import { localize } from '../utils/localize.js';

export function PartnerGrid({ partners }: { partners: Partner[] }) {
  const { language } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {partners.map((partner) => (
        <div
          key={partner.id}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-md hover:border-[#0B3D2E]/40 transition group grayscale hover:grayscale-0"
        >
          <div className="w-full h-14 flex items-center justify-center mb-3">
            {typeof partner.logoUrl === 'string' && partner.logoUrl.trim().length > 0 ? (
              <img src={partner.logoUrl} alt={localize(partner.name, language)} loading="lazy" className="max-w-full max-h-full object-contain" />
            ) : (
              <Building2 className="w-7 h-7 text-slate-400" />
            )}
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition">
            {localize(partner.name, language)}
          </span>
        </div>
      ))}
    </div>
  );
}
