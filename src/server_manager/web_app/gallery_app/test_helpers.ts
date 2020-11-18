// Copyright 2020 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import {Account, DigitalOceanApi, DigitalOceanDropletSpecification, DropletInfo, RegionInfo} from '../../infrastructure/digitalocean_api';
import {InMemoryStorage} from '../../infrastructure/memory_storage';
import {AccountId, DigitalOceanAccount, DigitalOceanLocation, DigitalOceanStatus} from '../../model/account';
import {CloudProviderId} from '../../model/cloud';
import * as server from '../../model/server';
import {AccessKey, DataUsageByAccessKey, ManagedServer, ManagedServerHost} from '../../model/server';
import {DisplayServerRepository} from '../display_server';

class FakeServer implements server.Server {
  private readonly id: string;
  private name = 'serverName';
  private metricsEnabled = false;
  protected apiUrl: string;

  constructor() {
    this.id = Math.random().toString();
  }

  getServerId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  setName(name: string): Promise<void> {
    this.name = name;
    return Promise.resolve();
  }

  getVersion(): string {
    return '1.2.3';
  }

  listAccessKeys(): Promise<AccessKey[]> {
    return Promise.resolve([]);
  }

  getDataUsage(): Promise<DataUsageByAccessKey> {
    return Promise.resolve({bytesTransferredByUserId: {}});
  }

  addAccessKey(): Promise<AccessKey> {
    return Promise.reject(new Error('FakeServer.addAccessKey not implemented'));
  }

  renameAccessKey(accessKeyId: server.AccessKeyId, name: string): Promise<void> {
    return Promise.reject(new Error('FakeServer.renameAccessKey not implemented'));
  }

  removeAccessKey(accessKeyId: server.AccessKeyId): Promise<void> {
    return Promise.reject(new Error('FakeServer.removeAccessKey not implemented'));
  }

  getAccessKeyDataLimit(): server.DataLimit|undefined {
    return undefined;
  }

  setAccessKeyDataLimit(limit: server.DataLimit): Promise<void> {
    return Promise.reject(new Error('FakeServer.setAccessKeyDataLimit not implemented'));
  }

  removeAccessKeyDataLimit(): Promise<void> {
    return Promise.resolve();
  }

  getMetricsEnabled(): boolean {
    return this.metricsEnabled;
  }

  setMetricsEnabled(metricsEnabled: boolean): Promise<void> {
    this.metricsEnabled = metricsEnabled;
    return Promise.resolve();
  }

  isHealthy(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getCreatedDate(): Date {
    return new Date();
  }

  getHostnameForAccessKeys(): string {
    return 'fake-server';
  }

  setHostnameForAccessKeys(hostname: string): Promise<void> {
    return Promise.reject(new Error('FakeServer.setHostname not implemented'));
  }

  getManagementApiUrl(): string {
    return this.apiUrl || Math.random().toString();
  }

  getPortForNewAccessKeys(): number|undefined {
    return undefined;
  }

  setPortForNewAccessKeys(): Promise<void> {
    return Promise.reject(new Error('FakeServer.setPortForNewAccessKeys not implemented'));
  }
}

class FakeManualServer extends FakeServer implements server.ManualServer {
  constructor(public manualServerConfig: server.ManualServerConfig) {
    super();
    this.apiUrl = this.manualServerConfig.apiUrl;
  }

  getCertificateFingerprint(): string {
    return this.manualServerConfig.certSha256;
  }

  forget(): void {
    throw new Error('FakeManualServer.forget not implemented');
  }
}

class FakeDigitalOceanApiClient implements DigitalOceanApi {
  constructor(public accessToken: string) {}

  // Return fake account data.
  getAccount(): Promise<Account> {
    return Promise.resolve({
      email: 'fake@email.com',
      uuid: 'fake',
      email_verified: true,
      status: 'active'
    });
  }

  // Other methods do not yet need implementations for tests to pass.
  createDroplet(
      displayName: string, region: string, publicKeyForSSH: string,
      dropletSpec: DigitalOceanDropletSpecification): Promise<{droplet: DropletInfo}> {
    return Promise.reject(new Error('createDroplet not implemented'));
  }

  deleteDroplet(dropletId: number): Promise<void> {
    return Promise.reject(new Error('deleteDroplet not implemented'));
  }

  // Return an empty list of regions by default.
  getRegionInfo(): Promise<RegionInfo[]> {
    return Promise.resolve([]);
  }

  getDroplet(dropletId: number): Promise<DropletInfo> {
    return Promise.reject(new Error('getDroplet not implemented'));
  }

  getDropletTags(dropletId: number): Promise<string[]> {
    return   Promise.reject(new Error('getDropletTags not implemented'));
  }

  // Return an empty list of droplets by default.
  getDropletsByTag(tag: string): Promise<DropletInfo[]> {
    return Promise.resolve([]);
  }

  getDroplets(): Promise<DropletInfo[]> {
    return Promise.reject(new Error('getDroplets not implemented'));
  }
}

export class FakeDigitalOceanServer extends FakeServer implements ManagedServer {
  constructor(private isInstalled = true) {
    super();
  }

  waitOnInstall(resetTimeout: boolean) {
    // Return a promise which does not yet fulfill, to simulate long
    // shadowbox install time.
    return new Promise<void>((fulfill, reject) => {});
  }

  getHost(): ManagedServerHost {
    return {
      getId: () => 'fake-host-id',
      getCloudProviderId: () => CloudProviderId.DigitalOcean,
      getLocationId: () => 'nyc1',
      getMonthlyOutboundTransferLimit: () => ({terabytes: 1}),
      getMonthlyCost: () => ({usd: 5}),
      delete: () => Promise.resolve(),
    };
  }

  isInstallCompleted(): boolean {
    return this.isInstalled;
  }
}

class FakeDigitalOceanAccount implements DigitalOceanAccount {
  private servers: ManagedServer[] = [];

  getId(): AccountId {
    return {
      cloudSpecificId: '',
      cloudProviderId: CloudProviderId.DigitalOcean,
    };
  }

  getDisplayName(): Promise<string> {
    return Promise.resolve('Test DigitalOcean account');
  }

  getCredentials(): object {
    return 'oauth-token' as unknown as object;
  }

  disconnect(): void {
    // no-op
  }

  getStatus(): Promise<DigitalOceanStatus> {
    return Promise.resolve(DigitalOceanStatus.ACTIVE);
  }

  listLocations(): Promise<DigitalOceanLocation[]> {
    return Promise.resolve([{
      regionId: 'nyc',
      dataCenterIds: ['nyc1'],
    }]);
  }

  createServer(): Promise<ManagedServer> {
    const newServer = new FakeDigitalOceanServer();
    this.servers.push(newServer);
    return Promise.resolve(newServer);
  }

  listServers(fetchFromHost: boolean): Promise<ManagedServer[]> {
    return Promise.resolve(this.servers);
  }

  registerAccountConnectionIssueListener(fn: () => void): void {
    // no-op
  }
}

class FakeManualServerRepository implements server.ManualServerRepository {
  private servers: server.ManualServer[] = [];

  addServer(config: server.ManualServerConfig) {
    const newServer = new FakeManualServer(config);
    this.servers.push(newServer);
    return Promise.resolve(newServer);
  }

  findServer(config: server.ManualServerConfig) {
    return this.servers.find(server => server.getManagementApiUrl() === config.apiUrl);
  }

  listServers() {
    return Promise.resolve(this.servers);
  }
}

class FakeDisplayServerRepository extends DisplayServerRepository {
  constructor() {
    super(new InMemoryStorage());
  }
}