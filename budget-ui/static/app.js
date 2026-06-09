let currentOrg = '';
let currentProduct = null;
let proxies = [];

// DOM Elements
const orgInput = document.getElementById('orgInput');
const loadProductsBtn = document.getElementById('loadProductsBtn');
const productList = document.getElementById('productList');
const productsLoading = document.getElementById('productsLoading');
const detailsSection = document.getElementById('detailsSection');
const selectedProductName = document.getElementById('selectedProductName');
const operationsList = document.getElementById('operationsList');
const opsLoading = document.getElementById('opsLoading');
const addOpBtn = document.getElementById('addOpBtn');
const opModal = document.getElementById('opModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelOpBtn = document.getElementById('cancelOpBtn');
const opForm = document.getElementById('opForm');
const modalTitle = document.getElementById('modalTitle');
const apiProxySelect = document.getElementById('apiProxySelect');
const modelInput = document.getElementById('modelInput');
const budgetInput = document.getElementById('budgetInput');
const intervalInput = document.getElementById('intervalInput');
const timeunitInput = document.getElementById('timeunitInput');
const inputPriceInput = document.getElementById('inputPriceInput');
const outputPriceInput = document.getElementById('outputPriceInput');
const editOpIndex = document.getElementById('editOpIndex');

// Event Listeners
loadProductsBtn.addEventListener('click', loadProducts);
addOpBtn.addEventListener('click', () => openModal('add'));
closeModalBtn.addEventListener('click', closeModal);
cancelOpBtn.addEventListener('click', closeModal);

opForm.addEventListener('submit', saveOperation);

// Functions
async function loadProducts() {
    currentOrg = orgInput.value.trim();
    if (!currentOrg) {
        alert('Please enter an Organization name');
        return;
    }

    productList.innerHTML = '';
    productsLoading.style.display = 'block';
    detailsSection.style.display = 'none';

    try {
        const response = await fetch(`/api/products?org=${currentOrg}`);
        const data = await response.json();
        
        if (response.ok) {
            let productNames = [];
            if (Array.isArray(data)) {
                productNames = data;
            } else if (data.apiProduct) {
                 productNames = data.apiProduct.map(p => p.name);
            }
            
            productNames = productNames.filter(p => typeof p === 'string');

            if (productNames.length === 0) {
                productList.innerHTML = '<li>No products found</li>';
            } else {
                productNames.forEach(name => {
                    const li = document.createElement('li');
                    li.textContent = name;
                    li.addEventListener('click', () => selectProduct(name));
                    productList.appendChild(li);
                });
            }
            
            loadProxies();
        } else {
            alert(`Error: ${data.error || 'Failed to load products'}`);
            productList.innerHTML = '<li>Error loading products</li>';
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
        productList.innerHTML = '<li>Error loading products</li>';
    } finally {
        productsLoading.style.display = 'none';
    }
}

async function loadProxies() {
    try {
        const response = await fetch(`/api/proxies?org=${currentOrg}`);
        const data = await response.json();
        
        if (response.ok) {
            proxies = Array.isArray(data) ? data : [];
            apiProxySelect.innerHTML = '<option value="">Select a Proxy</option>';
            proxies.forEach(proxy => {
                const option = document.createElement('option');
                option.value = proxy;
                option.textContent = proxy;
                apiProxySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load proxies:', error);
    }
}

async function selectProduct(name) {
    const items = productList.querySelectorAll('li');
    items.forEach(item => {
        if (item.textContent === name) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    selectedProductName.textContent = name;
    detailsSection.style.display = 'block';
    operationsList.innerHTML = '';
    opsLoading.style.display = 'block';

    try {
        const response = await fetch(`/api/products/${name}?org=${currentOrg}`);
        const data = await response.json();
        
        if (response.ok) {
            currentProduct = data;
            const ops = [];
            if (data.llmOperationGroup && data.llmOperationGroup.operationConfigs) {
                data.llmOperationGroup.operationConfigs.forEach(config => {
                    if (config.llmOperations) {
                        config.llmOperations.forEach(llmOp => {
                            ops.push({
                                apiSource: config.apiSource,
                                resource: llmOp.resource,
                                model: llmOp.model,
                                attributes: config.attributes || [],
                                llmTokenQuota: config.llmTokenQuota || null
                            });
                        });
                    }
                });
            }
            renderOperations(ops);
        } else {
            alert(`Error: ${data.error || 'Failed to load product details'}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        opsLoading.style.display = 'none';
    }
}

function renderOperations(ops) {
    operationsList.innerHTML = '';
    
    if (ops.length === 0) {
        operationsList.innerHTML = '<div class="loading">No LLM budgets defined</div>';
        return;
    }

    ops.forEach((op, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        
        const hasQuota = op.llmTokenQuota && op.llmTokenQuota.limit;
        
        let budget = '';
        let interval = '';
        let timeunit = '';
        let inputPrice = '';
        let outputPrice = '';
        
        if (hasQuota) {
            budget = op.llmTokenQuota.limit ? (parseFloat(op.llmTokenQuota.limit) / 100000000).toString() : '';
            interval = op.llmTokenQuota.interval || '';
            timeunit = op.llmTokenQuota.timeUnit || '';
            
            const inputPriceAttr = op.attributes.find(attr => attr.name === 'input_price_per_100M');
            const outputPriceAttr = op.attributes.find(attr => attr.name === 'output_price_per_100M');
            
            inputPrice = inputPriceAttr ? (parseFloat(inputPriceAttr.value) / 100).toString() : '';
            outputPrice = outputPriceAttr ? (parseFloat(outputPriceAttr.value) / 100).toString() : '';
        }
        
        card.innerHTML = `
            <div class="card-header">
                <h4>${op.apiSource}</h4>
            </div>
            <div class="card-body">
                <p><span class="label">Path:</span> ${op.resource || ''}</p>
                <p><span class="label">Model:</span> <strong>${op.model || ''}</strong></p>
                <p><span class="label">Budget(USD):</span> ${budget}</p>
                <p><span class="label">Interval:</span> ${interval}</p>
                <p><span class="label">Time Unit:</span> ${timeunit}</p>
                <p><span class="label">Input Price per M:</span> ${inputPrice}</p>
                <p><span class="label">Output Price per M:</span> ${outputPrice}</p>
            </div>
            <div class="card-actions">
                <button class="secondary-btn edit-btn" data-index="${index}">Edit</button>
                <button class="secondary-btn delete-btn" data-index="${index}" style="color: var(--danger-color)">Delete</button>
            </div>
        `;
        
        card.querySelector('.edit-btn').addEventListener('click', () => openModal('edit', index));
        card.querySelector('.delete-btn').addEventListener('click', () => deleteOperation(index));
        
        operationsList.appendChild(card);
    });
}

function openModal(mode, index = -1) {
    opModal.style.display = 'flex';
    if (mode === 'add') {
        modalTitle.textContent = 'Add LLM Budget';
        opForm.reset();
        editOpIndex.value = '-1';
        modelInput.value = '';
        budgetInput.value = '';
        intervalInput.value = '';
        timeunitInput.value = '';
        inputPriceInput.value = '';
        outputPriceInput.value = '';
    } else if (mode === 'edit') {
        modalTitle.textContent = 'Edit LLM Budget';
        
        const ops = [];
        if (currentProduct.llmOperationGroup && currentProduct.llmOperationGroup.operationConfigs) {
            currentProduct.llmOperationGroup.operationConfigs.forEach(config => {
                if (config.llmOperations) {
                    config.llmOperations.forEach(llmOp => {
                        ops.push({
                            apiSource: config.apiSource,
                            resource: llmOp.resource,
                            model: llmOp.model,
                            attributes: config.attributes || [],
                            llmTokenQuota: config.llmTokenQuota || null
                        });
                    });
                }
            });
        }
        
        const op = ops[index];
        editOpIndex.value = index;
        
        apiProxySelect.value = op.apiSource;
        modelInput.value = op.model;
        
        if (op.llmTokenQuota) {
            budgetInput.value = op.llmTokenQuota.limit ? op.llmTokenQuota.limit / 100000000 : '';
            intervalInput.value = op.llmTokenQuota.interval || '';
            timeunitInput.value = op.llmTokenQuota.timeUnit || '';
        } else {
            budgetInput.value = '';
            intervalInput.value = '';
            timeunitInput.value = '';
        }
        
        const inputPriceAttr = op.attributes.find(attr => attr.name === 'input_price_per_100M');
        const outputPriceAttr = op.attributes.find(attr => attr.name === 'output_price_per_100M');
        
        inputPriceInput.value = inputPriceAttr ? (parseFloat(inputPriceAttr.value) / 100).toString() : '';
        outputPriceInput.value = outputPriceAttr ? (parseFloat(outputPriceAttr.value) / 100).toString() : '';
    }
}

function closeModal() {
    opModal.style.display = 'none';
}

function addAttributeRow(key, value) {
    const row = document.createElement('div');
    row.className = 'attr-row';
    row.innerHTML = `
        <input type="text" class="attr-key" placeholder="Key" value="${key}" required>
        <input type="text" class="attr-value" placeholder="Value" value="${value}" required>
        <button type="button" class="remove-attr-btn">&times;</button>
    `;
    
    row.querySelector('.remove-attr-btn').addEventListener('click', () => {
        row.remove();
    });
    
    customAttrsContainer.appendChild(row);
}

async function saveOperation(e) {
    e.preventDefault();
    
    const index = parseInt(editOpIndex.value);
    const apiProxy = apiProxySelect.value;
    const model = modelInput.value;
    
    const attributes = [];
    const inputPrice = inputPriceInput.value.trim();
    const outputPrice = outputPriceInput.value.trim();
    
    if (inputPrice) {
        attributes.push({ name: 'input_price_per_100M', value: String(parseFloat(inputPrice) * 100) });
    }
    if (outputPrice) {
        attributes.push({ name: 'output_price_per_100M', value: String(parseFloat(outputPrice) * 100) });
    }
    
    const budget = budgetInput.value.trim();
    const interval = intervalInput.value.trim();
    const timeunit = timeunitInput.value.trim();
    
    let llmTokenQuota = null;
    if (budget || interval || timeunit) {
        llmTokenQuota = {};
        if (budget) llmTokenQuota.limit = String(Math.round(parseFloat(budget) * 100000000));
        if (interval) llmTokenQuota.interval = interval;
        if (timeunit) llmTokenQuota.timeUnit = timeunit;
    }

    const newConfig = {
        apiSource: apiProxy,
        llmOperations: [
            {
                resource: '/',
                model: model
            }
        ],
        attributes: attributes
    };
    
    if (llmTokenQuota) {
        newConfig.llmTokenQuota = llmTokenQuota;
    }

    let operationConfigs = [];
    if (currentProduct.llmOperationGroup && currentProduct.llmOperationGroup.operationConfigs) {
        operationConfigs = [...currentProduct.llmOperationGroup.operationConfigs];
    }

    const flatOps = [];
    operationConfigs.forEach((config, cIndex) => {
        if (config.llmOperations) {
            config.llmOperations.forEach((llmOp, lIndex) => {
                flatOps.push({ cIndex, lIndex });
            });
        }
    });

    if (index === -1) {
        operationConfigs.push(newConfig);
    } else {
        if (flatOps[index]) {
            const { cIndex } = flatOps[index];
            operationConfigs[cIndex] = newConfig;
        }
    }

    const updatedProduct = {
        ...currentProduct,
        llmOperationGroup: {
            operationConfigs: operationConfigs
        }
    };

    currentProduct = updatedProduct;
    
    const ops = [];
    updatedProduct.llmOperationGroup.operationConfigs.forEach(config => {
        if (config.llmOperations) {
            config.llmOperations.forEach(llmOp => {
                ops.push({
                    apiSource: config.apiSource,
                    resource: llmOp.resource,
                    model: llmOp.model,
                    attributes: config.attributes || [],
                    llmTokenQuota: config.llmTokenQuota || null
                });
            });
        }
    });
    renderOperations(ops);
    closeModal();

    try {
        const response = await fetch(`/api/products/${currentProduct.name}?org=${currentOrg}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedProduct)
        });
        
        if (!response.ok) {
            const data = await response.json();
            alert(`Failed to save: ${data.error || 'Unknown error'}`);
            selectProduct(currentProduct.name);
        }
    } catch (error) {
        alert(`Error saving: ${error.message}`);
        selectProduct(currentProduct.name);
    }
}

async function deleteOperation(index) {
    if (!confirm('Are you sure you want to delete this operation?')) return;
    
    let operationConfigs = [...(currentProduct.llmOperationGroup.operationConfigs || [])];
    
    const flatOps = [];
    operationConfigs.forEach((config, cIndex) => {
        config.llmOperations.forEach((llmOp, lIndex) => {
            flatOps.push({ cIndex, lIndex });
        });
    });

    const { cIndex, lIndex } = flatOps[index];
    
    operationConfigs[cIndex].llmOperations.splice(lIndex, 1);
    
    if (operationConfigs[cIndex].llmOperations.length === 0) {
        operationConfigs.splice(cIndex, 1);
    }

    const updatedProduct = {
        ...currentProduct,
        llmOperationGroup: {
            operationConfigs: operationConfigs
        }
    };

    currentProduct = updatedProduct;
    
    const ops = [];
    updatedProduct.llmOperationGroup.operationConfigs.forEach(config => {
        config.llmOperations.forEach(llmOp => {
            ops.push({
                apiSource: config.apiSource,
                resource: llmOp.resource,
                model: llmOp.model,
                attributes: config.attributes || []
            });
        });
    });
    renderOperations(ops);

    try {
        const response = await fetch(`/api/products/${currentProduct.name}?org=${currentOrg}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedProduct)
        });
        
        if (!response.ok) {
            const data = await response.json();
            alert(`Failed to delete: ${data.error || 'Unknown error'}`);
            selectProduct(currentProduct.name);
        }
    } catch (error) {
        alert(`Error deleting: ${error.message}`);
        selectProduct(currentProduct.name);
    }
}

window.addEventListener('click', (e) => {
    if (e.target === opModal) {
        closeModal();
    }
});
