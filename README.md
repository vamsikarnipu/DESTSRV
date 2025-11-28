# Service Destination Consumption - End-to-End Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Provider Application (CustomLIB)](#provider-application-customlib)
4. [Consumer Application (CustomLIBS)](#consumer-application-customlibs)
5. [Deployment Steps](#deployment-steps)
6. [Verification Checklist](#verification-checklist)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide explains how to set up **service destination sharing** between two SAP BTP applications:
- **Provider (CustomLIB)**: A CAP application that creates and manages a destination service with destinations
- **Consumer (CustomLIBS)**: A UI5 application that consumes the destination service from the provider

### What is Happening?

1. **CustomLIB** (Provider) creates a destination service instance with two destinations:
   - `CAP_BACKEND`: Points to the CAP backend service URL
   - `APP_ROUTER`: Points to the App Router URL

2. **CustomLIBS** (Consumer) consumes this existing destination service to access the destinations configured in CustomLIB.

3. The UI5 app in CustomLIBS uses the `APP_ROUTER` destination (configured in `xs-app.json`) to route requests to the provider's App Router.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CustomLIB (Provider)                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ CAP Backend  │    │ App Router   │    │ Destination  │  │
│  │  (servicedest│    │  (servicedest│    │   Service    │  │
│  │    -srv)     │    │   router)    │    │  Instance    │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │          │
│         └───────────────────┴───────────────────┘          │
│                            │                                │
│         Creates destinations: CAP_BACKEND, APP_ROUTER       │
└────────────────────────────┼────────────────────────────────┘
                             │
                             │ (Existing Service Reference)
                             │
┌────────────────────────────┼────────────────────────────────┐
│                    CustomLIBS (Consumer)                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  UI5 App     │    │ Destination  │    │ HTML5 App   │  │
│  │  (librarydest│    │   Content    │    │   Runtime    │  │
│  │   webapp)    │    │   Module     │    │              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │          │
│         │                   │                   │          │
│         └───────────────────┴───────────────────┘          │
│                            │                                │
│         Consumes destinations: APP_ROUTER, CAP_BACKEND      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Provider Application (CustomLIB)

### Purpose
Creates a destination service instance that will be shared with other applications.

### Key Files

#### 1. `mta.yaml` - Main Configuration

**Location**: `CustomLIB/mta.yaml`

**Key Sections**:

```yaml
# Resource: Destination Service Instance
resources:
  - name: servicedest-destination
    type: org.cloudfoundry.managed-service
    requires:
      - name: srv-api      # Needs CAP backend URL
      - name: app-api      # Needs App Router URL
    parameters:
      service: destination
      service-plan: lite
      config:
        HTML5Runtime_enabled: true    # ⚠️ CRITICAL: Enables HTML5 apps to access destinations
        init_data:
          instance:
            destinations:
              - Name: CAP_BACKEND
                Type: HTTP
                ProxyType: Internet
                Authentication: NoAuthentication
                URL: ~{srv-api/srv-url}    # Dynamic URL from CAP service
              
              - Name: APP_ROUTER
                Type: HTTP
                ProxyType: Internet
                Authentication: NoAuthentication
                URL: ~{app-api/app-uri}    # Dynamic URL from App Router
            existing_destinations_policy: update
        version: 1.0.0
```

**What to Check**:
- ✅ `HTML5Runtime_enabled: true` is present (line 73)
- ✅ Both destinations (`CAP_BACKEND` and `APP_ROUTER`) are configured
- ✅ URLs use property references (`~{srv-api/srv-url}` and `~{app-api/app-uri}`)

#### 2. Module: `servicedest-srv` (CAP Backend)

**What it does**:
- Provides the CAP backend service
- Exports the service URL via `srv-api` provide

**Key Configuration**:
```yaml
provides:
  - name: srv-api
    properties:
      srv-url: ${default-url}    # This becomes the CAP_BACKEND destination URL
```

#### 3. Module: `servicedest` (App Router)

**What it does**:
- Provides the App Router service
- Exports the router URL via `app-api` provide
- Uses `CAP_BACKEND` destination internally

**Key Configuration**:
```yaml
provides:
  - name: app-api
    properties:
      app-protocol: ${protocol}
      app-uri: ${default-uri}    # This becomes the APP_ROUTER destination URL
```

---

## 🔧 Consumer Application (CustomLIBS)

### Purpose
Consumes the destination service from CustomLIB to access the `APP_ROUTER` and `CAP_BACKEND` destinations.

### Key Files

#### 1. `mta.yaml` - Main Configuration

**Location**: `CustomLIBS/mta.yaml`

**Key Sections**:

##### a) Existing Service Resource (Lines 119-123)
```yaml
resources:
  # === EXTERNAL DESTINATION FROM PROVIDER ===
  - name: servicedest-destination
    type: org.cloudfoundry.existing-service
    parameters:
      service-name: servicedest-destination    # ⚠️ Must match actual service instance name
```

**What to Check**:
- ✅ `service-name` matches the actual deployed service instance name from CustomLIB
- ✅ Type is `org.cloudfoundry.existing-service`

##### b) Destination Content Module (Lines 8-52)
```yaml
modules:
  - name: librarydest-destination-content
    type: com.sap.application.content
    requires:
      - name: librarydest-destination-service
        parameters:
          content-target: true
      - name: servicedest-destination          # ⚠️ References provider's service
        parameters:
          content-target: true                  # ⚠️ CRITICAL: Makes destinations available
    parameters:
      content:
        instance:
          destinations:
            # ... other destinations ...
            - Name: APP_ROUTER                  # ⚠️ Destination from provider
              ServiceInstanceName: servicedest-destination
              sap.cloud.service: servicedest
              Type: HTTP
              ProxyType: Internet
              Authentication: NoAuthentication
            - Name: CAP_BACKEND                 # ⚠️ Destination from provider
              ServiceInstanceName: servicedest-destination
              sap.cloud.service: servicedest
              Type: HTTP
              ProxyType: Internet
              Authentication: NoAuthentication
          existing_destinations_policy: update
```

**What to Check**:
- ✅ `servicedest-destination` is in the `requires` section with `content-target: true`
- ✅ `APP_ROUTER` and `CAP_BACKEND` destinations are configured
- ✅ `ServiceInstanceName` matches the resource name `servicedest-destination`
- ✅ `sap.cloud.service` matches the provider's MTA ID (`servicedest`)

##### c) HTML5 Module (Lines 69-81)
```yaml
  - name: librarydest
    type: html5
    path: .
    requires:
      - name: servicedest-destination    # ⚠️ Binds the destination service
```

**What to Check**:
- ✅ `servicedest-destination` is in the `requires` section

#### 2. `xs-app.json` - App Router Configuration

**Location**: `CustomLIBS/xs-app.json`

**Key Configuration**:
```json
{
  "routes": [
    {
      "source": "^/extlib/(.*)$",
      "target": "/$1",
      "destination": "APP_ROUTER",        // ⚠️ Uses destination from provider
      "authenticationType": "none",
      "csrfProtection": false
    }
  ]
}
```

**What to Check**:
- ✅ Route uses `"destination": "APP_ROUTER"` (must match destination name from provider)
- ✅ Pattern matches your use case (`^/extlib/(.*)$`)

---

## 🚀 Deployment Steps

### Step 1: Deploy Provider (CustomLIB) First

**Why first?** The consumer needs the destination service to exist before it can reference it.

```bash
cd CustomLIB

# Build the MTA
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/servicedest_1.0.1.mtar
```

**Verify Deployment**:
```bash
# Check service instance was created
cf services | grep servicedest-destination

# Check destinations are configured
cf service servicedest-destination
```

**Expected Output**:
- Service instance: `servicedest-destination` (or `servicedest-servicedest-destination` if prefixed)
- Service type: `destination`
- Service plan: `lite`

### Step 2: Verify Service Instance Name

**IMPORTANT**: The actual service instance name might be prefixed with the MTA ID.

```bash
# List all services
cf services

# Look for the destination service
# It might be named:
# - servicedest-destination (if no prefix)
# - servicedest-servicedest-destination (if prefixed with MTA ID)
```

**If the name is different**, update `CustomLIBS/mta.yaml` line 123:
```yaml
service-name: <actual-service-instance-name>
```

### Step 3: Deploy Consumer (CustomLIBS)

```bash
cd CustomLIBS

# Build the MTA
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/librarydest_0.0.1.mtar
```

**Verify Deployment**:
```bash
# Check HTML5 app was deployed
cf apps | grep librarydest

# Check destinations are available
cf service librarydest-destination-service
```

---

## ✅ Verification Checklist

### Provider (CustomLIB) Verification

- [ ] **Service Instance Created**
  ```bash
  cf services | grep servicedest-destination
  ```

- [ ] **Destinations Configured**
  ```bash
  cf service servicedest-destination
  ```
  Should show `CAP_BACKEND` and `APP_ROUTER` destinations

- [ ] **HTML5Runtime Enabled**
  Check in BTP Cockpit → Services → Destination → Instance → Configuration
  Should see `HTML5Runtime_enabled: true`

- [ ] **Service Accessible**
  ```bash
  cf service-key servicedest-destination <key-name>
  ```

### Consumer (CustomLIBS) Verification

- [ ] **Service Binding**
  ```bash
  cf env librarydest
  ```
  Should show `servicedest-destination` in VCAP_SERVICES

- [ ] **Destinations Available**
  Check in BTP Cockpit → Services → Destination → Instance (librarydest-destination-service)
  Should see `APP_ROUTER` and `CAP_BACKEND` destinations

- [ ] **App Router Configuration**
  Verify `xs-app.json` has the correct destination name

- [ ] **Application Running**
  ```bash
  cf apps | grep librarydest
  ```
  Status should be `started`

### End-to-End Verification

- [ ] **Test Destination Access**
  1. Open the UI5 app in browser
  2. Navigate to a route that uses `APP_ROUTER` destination (e.g., `/extlib/...`)
  3. Check browser network tab - should see successful requests

- [ ] **Check Logs**
  ```bash
  cf logs librarydest --recent
  ```
  Should not show destination-related errors

---

## 🔍 Troubleshooting

### Issue 1: "Service instance not found" Error

**Symptoms**:
- Deployment fails with: `Service instance 'servicedest-destination' not found`

**Solution**:
1. Verify the service instance name:
   ```bash
   cf services
   ```
2. Update `CustomLIBS/mta.yaml` line 123 with the correct service name
3. Redeploy CustomLIBS

### Issue 2: "Internal Server Error" When Accessing Destination

**Symptoms**:
- App deploys successfully but returns 500 error when using destination

**Possible Causes & Solutions**:

#### a) HTML5Runtime Not Enabled
**Check**: Provider's destination service configuration
```yaml
# In CustomLIB/mta.yaml
config:
  HTML5Runtime_enabled: true    # Must be present
```
**Fix**: Add `HTML5Runtime_enabled: true` and redeploy CustomLIB

#### b) Destination Not in Destination Content
**Check**: Consumer's destination-content module
```yaml
# In CustomLIBS/mta.yaml
- name: librarydest-destination-content
  requires:
    - name: servicedest-destination
      parameters:
        content-target: true    # Must be present
```
**Fix**: Ensure `servicedest-destination` is required with `content-target: true`

#### c) Destination Name Mismatch
**Check**: Destination names match exactly
- Provider defines: `APP_ROUTER`
- Consumer references: `APP_ROUTER` (in xs-app.json and mta.yaml)
- Must match exactly (case-sensitive)

#### d) Service Instance Name Mismatch
**Check**: Service instance name in consumer matches provider
```bash
# Get actual service name
cf services

# Update CustomLIBS/mta.yaml
service-name: <actual-name>
```

### Issue 3: Destinations Not Visible in BTP Cockpit

**Symptoms**:
- Destinations don't appear in consumer's destination service

**Solution**:
1. Verify `content-target: true` is set for `servicedest-destination` in destination-content module
2. Check `ServiceInstanceName` matches the resource name
3. Verify `sap.cloud.service` matches provider's MTA ID
4. Redeploy consumer application

### Issue 4: CORS or Authentication Errors

**Symptoms**:
- Browser console shows CORS errors or 401/403 errors

**Solution**:
1. Check destination authentication settings:
   ```yaml
   Authentication: NoAuthentication    # Or appropriate auth type
   ```
2. Verify `forwardAuthToken` if using authentication
3. Check `xs-app.json` route configuration:
   ```json
   "authenticationType": "none"    # Or appropriate type
   ```

### Issue 5: URL Resolution Issues

**Symptoms**:
- Destinations have incorrect URLs

**Solution**:
1. Verify provider's URL properties are correctly exported:
   ```yaml
   # In CustomLIB/mta.yaml
   provides:
     - name: srv-api
       properties:
         srv-url: ${default-url}
   ```
2. Check URL references in destination configuration:
   ```yaml
   URL: ~{srv-api/srv-url}    # Must match provide name
   ```

---

## 📝 File Checklist

### Provider (CustomLIB) Files to Review

- [ ] `mta.yaml`
  - [ ] Resource `servicedest-destination` has `HTML5Runtime_enabled: true`
  - [ ] Destinations `CAP_BACKEND` and `APP_ROUTER` are configured
  - [ ] URLs use property references correctly

- [ ] `xs-security.json`
  - [ ] Security configuration is appropriate

- [ ] `package.json`
  - [ ] Dependencies are correct

### Consumer (CustomLIBS) Files to Review

- [ ] `mta.yaml`
  - [ ] Existing service resource has correct `service-name`
  - [ ] Destination-content module requires `servicedest-destination` with `content-target: true`
  - [ ] Destinations `APP_ROUTER` and `CAP_BACKEND` are configured in destination-content
  - [ ] HTML5 module requires `servicedest-destination`
  - [ ] `ServiceInstanceName` matches resource name
  - [ ] `sap.cloud.service` matches provider's MTA ID

- [ ] `xs-app.json`
  - [ ] Route uses correct destination name (`APP_ROUTER`)
  - [ ] Route pattern matches use case
  - [ ] Authentication type is appropriate

- [ ] `xs-security.json`
  - [ ] Security configuration is appropriate

---

## 🎯 Summary: Is This Approach Perfect?

### ✅ What's Correct

1. **Service Sharing**: Using `org.cloudfoundry.existing-service` is the correct approach for sharing services between MTAs
2. **Destination Configuration**: Destinations are properly configured in both provider and consumer
3. **HTML5Runtime**: Enabled on provider's destination service (required for HTML5 apps)
4. **Content Target**: Consumer's destination-content module correctly references the provider service

### ⚠️ Potential Improvements

1. **Service Instance Naming**: 
   - Consider using explicit `service-name` in provider to avoid naming ambiguity
   - Document the actual service instance name for reference

2. **Error Handling**:
   - Add validation in deployment scripts to check service existence
   - Add health checks for destination availability

3. **Security**:
   - Consider authentication requirements for destinations
   - Review `forwardAuthToken` settings if needed

4. **Documentation**:
   - Document the actual service instance name after first deployment
   - Keep a record of destination URLs for troubleshooting

### 🔧 Recommended Next Steps

1. **Deploy and Test**: Follow the deployment steps and verify everything works
2. **Monitor Logs**: Check application logs for any destination-related issues
3. **Test Endpoints**: Verify that routes using `APP_ROUTER` destination work correctly
4. **Update Documentation**: Document the actual service instance name for future reference

---

## 📚 Additional Resources

- [SAP BTP Destination Service Documentation](https://help.sap.com/docs/btp/sap-business-technology-platform/destination-service)
- [MTA Development Guide](https://sap.github.io/cloud-mta-build-tool/)
- [HTML5 Application Repository](https://help.sap.com/docs/btp/sap-business-technology-platform/html5-application-repository-service)

---

## 🆘 Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review application logs: `cf logs <app-name> --recent`
3. Verify service bindings: `cf env <app-name>`
4. Check BTP Cockpit for service and destination configurations

---

**Last Updated**: Based on current MTA configuration files
**Status**: ✅ Configuration verified and ready for deployment

