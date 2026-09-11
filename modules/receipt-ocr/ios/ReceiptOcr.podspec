require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ReceiptOcr'
  s.version        = package['version']
  s.summary        = package['description']
  s.author         = 'PayTsek'
  s.homepage       = 'https://www.paytsek.online'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # On-device text recognition (model bundled in the SDK).
  s.dependency 'GoogleMLKit/TextRecognition', '~> 7.0'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
