export type ServiceCategory = string;

export interface Service {
  id: number;
  slug: string;
  category: ServiceCategory;
  name: string;
  desc: string;
  price: string;
}
