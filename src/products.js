import { promptInput } from './prompts.js';
import { apiGet, apiPost } from './apiUtils.js';

async function getProducts(config, token) {
  const accessId = config.accessId;
  const productsEndpoint = config.baseUrl + "/products?accessType=" + config.accessType + "&accessId=" + accessId + "&limit=10&offset=0";

  const res = await apiGet(productsEndpoint, token);

  if (!res.ok) {
    const text = await res.text();
    console.error("Error retrieving products: ", res.status, res.statusText);
    console.error(text);
    throw new Error(`Error retrieving products: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  let products = [];
  for (const product of data.results) {
    products.push({ name: product.name, id: product.id, state: product.state });
  }
  return products;
}

async function createProduct(context) {
  // get the product name from the user
  const productName = await promptInput('Enter product name');

  const newProduct = {
    name: productName,
    authoringApp: "INVENTOR",
    state: "AVAILABLE"
  }

  return await postProduct(context.config, context.token, newProduct);
}

async function postProduct(config, token, productData) {
  const accessId = config.accessId;
  const productsEndpoint = config.baseUrl + "/products?accessType=" + config.accessType + "&accessId=" + accessId;

  const res = await apiPost(productsEndpoint, token, productData);
  
  if (!res.ok) {
    const text = await res.text();
    console.error("Error creating product: ", res.status, res.statusText);
    console.error(text);
    throw new Error(`Error creating product: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  console.log("Product created successfully");
  return { name: data.name, id: data.id, state: data.state };
}

async function handleProductUpdate(updateType, context) {

  switch (updateType) {
    case "CREATE":
      return await createProduct(context);
    default:
      console.log("unsupported option: " + updateType);
      break;
  }

  process.exit(1);
}

export { getProducts, handleProductUpdate };