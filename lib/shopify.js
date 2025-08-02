import axios from 'axios';

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

const shopifyClient = axios.create({
  baseURL: `https://${domain}/api/2023-04/graphql.json`,
  headers: {
    'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

export const getProducts = async () => {
  const query = `
    {
      products(first: 20) {
        edges {
          node {
            id
            title
            description
            images(first: 1) {
              edges {
                node {
                  src
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await shopifyClient.post('', { query });
  return response.data.data.products.edges.map(({ node }) => node);
};