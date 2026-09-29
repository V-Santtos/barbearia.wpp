import { useState, useEffect, useCallback } from 'react';
import { getServices } from '../api';
import { type Service } from '../services';

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getServices() as Service[];
      setServices(list);
      setError(null);
    } catch (err: any) {
      setServices([]);
      setError(err.message ?? 'Erro ao carregar servicos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, error, refresh: fetchServices };
}
