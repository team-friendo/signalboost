// TODO(aguestuser|2020-02-05)
//  these should probably produce more random default values eventually!

export const inboundAttachmentFactory = attrs => ({
  contentType: 'image/jpeg',
  id: 1461823935771385721,
  size: 1756017,
  storedFilename: '/var/lib/signald/attachments/1461823935771385721',
  width: 4032,
  height: 3024,
  voiceNote: false,
  preview: { present: false },
  key: 'cpdTsaYm9fsE+T29HtCl8qWW2LZPhM32zy82K4VYjTcsqtCIsRxYivSEnxvP6qHD9VwZPrAjFlzZtw6DYWAiig==',
  digest: 'UYm6uzLlrw2xEezccQtb0jqE4jSDq0+09JvySk+EzrQ=',
  ...attrs,
})

export const outboundAttachmentFactory = attrs => ({
  filename: '/var/lib/signald/attachments/1461823935771385721',
  width: 4032,
  height: 3024,
  voiceNote: false,
  ...attrs,
})
