/**
 * Represents a product.
 */
export interface Product {
  /**
   * The product name.
   */
  name: string;
  /**
   * The product dosage.
   */
dosage: string;
  /**
   * The product manufacturer.
   */
  manufacturer: string;
}

/**
 * Asynchronously retrieves product information for a given name.
 *
 * @param name The name of product to retrieve information.
 * @returns A promise that resolves to a list of Product object containing product information.
 */
export async function getProducts(name: string): Promise<Product[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      name: 'product1',
      dosage: '10mg',
      manufacturer: 'manufacturer1',
    },
    {
      name: 'product2',
      dosage: '20mg',
      manufacturer: 'manufacturer2',
    },
  ];
}
