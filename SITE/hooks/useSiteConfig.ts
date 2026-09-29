import { useState, useEffect, useCallback } from 'react';
import { getConfig, getServiceCategories } from '../api';
import { SITE_CONFIG, type SiteConfig, type CategoryConfig } from '../siteConfig';

const INITIAL_CONFIG: SiteConfig = {
  ...SITE_CONFIG,
  categories: [],
  filtersEnabled: false,
};

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>(INITIAL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [homeResult, categoriesResult] = await Promise.allSettled([
        getConfig('home'),
        getServiceCategories(),
      ]);

      const home =
        homeResult.status === 'fulfilled'
          ? homeResult.value as Partial<Omit<SiteConfig, 'categories' | 'filtersEnabled'>>
          : {};

      if (categoriesResult.status === 'rejected') {
        setConfig((prev) => ({
          ...prev,
          ...home,
          categories: [],
          filtersEnabled: false,
        }));
        setError(categoriesResult.reason?.message ?? 'Erro ao carregar categorias');
        return;
      }

      const categorias = categoriesResult.value;
      let categories: CategoryConfig[];
      let filtersEnabled: boolean;
      if (Array.isArray(categorias)) {
        categories = categorias as CategoryConfig[];
        filtersEnabled = false;
      } else {
        const cat = categorias as { filtersEnabled: boolean; items: CategoryConfig[] };
        categories = cat.items ?? [];
        filtersEnabled = cat.filtersEnabled ?? false;
      }

      setConfig({
        ...SITE_CONFIG,
        ...home,
        categories,
        filtersEnabled,
      });
      setError(null);
    } catch (err: any) {
      setConfig(INITIAL_CONFIG);
      setError(err.message ?? 'Erro ao carregar configuracao');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, refresh: fetchConfig };
}
