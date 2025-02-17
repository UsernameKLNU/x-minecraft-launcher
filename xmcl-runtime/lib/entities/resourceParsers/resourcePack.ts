import { PackMeta, readIcon, readPackMeta } from '@xmcl/resourcepack'
import { ResourceType, ResourceDomain } from '@xmcl/runtime-api'
import { ResourceParser } from '../resource'

export const resourcePackParser: ResourceParser<PackMeta.Pack> = ({
  type: ResourceType.ResourcePack,
  domain: ResourceDomain.ResourcePacks,
  ext: '.zip',
  parseIcon: async (meta, fs) => readIcon(fs),
  parseMetadata: fs => readPackMeta(fs),
  getSuggestedName: () => '',
  getUri: (_) => [],
})
