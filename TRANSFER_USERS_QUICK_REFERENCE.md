# Stock Transfer Users - Quick Reference

**Password for ALL users:** `password`

---

## 📋 USER LIST BY LOCATION

### 🏢 Main Warehouse
| Username             | Role     | Step  |
|----------------------|----------|-------|
| warehouse_clerk      | Creator  | Step 1: Create Transfer |
| warehouse_supervisor | Checker  | Step 2: Check/Approve |
| warehouse_manager    | Sender   | Step 3: Send (stock -) |
| warehouse_receiver   | Receiver | Step 4: Receive (stock +) |

### 🏪 Main Store
| Username             | Role     | Step  |
|----------------------|----------|-------|
| mainstore_clerk      | Creator  | Step 1: Create Transfer |
| mainstore_supervisor | Checker  | Step 2: Check/Approve |
| store_manager        | Sender   | Step 3: Send (stock -) |
| mainstore_receiver   | Receiver | Step 4: Receive (stock +) |

### 📍 Bambang
| Username           | Role     | Step  |
|--------------------|----------|-------|
| bambang_clerk      | Creator  | Step 1: Create Transfer |
| bambang_supervisor | Checker  | Step 2: Check/Approve |
| bambang_manager    | Sender   | Step 3: Send (stock -) |
| bambang_receiver   | Receiver | Step 4: Receive (stock +) |

### 📍 Tuguegarao
| Username          | Role     | Step  |
|-------------------|----------|-------|
| tugue_clerk       | Creator  | Step 1: Create Transfer |
| tugue_supervisor  | Checker  | Step 2: Check/Approve |
| tugue_manager     | Sender   | Step 3: Send (stock -) |
| tugue_receiver    | Receiver | Step 4: Receive (stock +) |

### 📍 Santiago
| Username            | Role     | Step  |
|---------------------|----------|-------|
| santiago_clerk      | Creator  | Step 1: Create Transfer |
| santiago_supervisor | Checker  | Step 2: Check/Approve |
| santiago_manager    | Sender   | Step 3: Send (stock -) |
| santiago_receiver   | Receiver | Step 4: Receive (stock +) |

### 📍 Baguio
| Username          | Role     | Step  |
|-------------------|----------|-------|
| baguio_clerk      | Creator  | Step 1: Create Transfer |
| baguio_supervisor | Checker  | Step 2: Check/Approve |
| baguio_manager    | Sender   | Step 3: Send (stock -) |
| baguio_receiver   | Receiver | Step 4: Receive (stock +) |

---

## 🔄 WORKFLOW

```
Step 1: CREATE     → Clerk creates transfer
Step 2: CHECK      → Supervisor approves
Step 3: SEND       → Manager confirms shipment (STOCK DEDUCTED)
Step 4: RECEIVE    → Receiver accepts (STOCK ADDED)
```

---

## 💡 COMMON SCENARIOS

**Warehouse → Store:**
```
warehouse_clerk → warehouse_supervisor → warehouse_manager → mainstore_receiver
```

**Store → Bambang:**
```
mainstore_clerk → mainstore_supervisor → store_manager → bambang_receiver
```

**Bambang → Warehouse:**
```
bambang_clerk → bambang_supervisor → bambang_manager → warehouse_receiver
```

---

**Total Users:** 24 (4 per location × 6 locations)
**All Passwords:** `password`
