'use client'

import React, { useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { useChat } from '@/context/chat-context'
import { useSettings } from '@/context/settings-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent as TabsContent_Inner, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LogOut, Trash2, User, Palette, Bell, Bot, RefreshCcw } from 'lucide-react'

// Create renamed component to avoid naming conflict
const TabsContent = TabsContent_Inner

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, logout, updateProfile } = useAuth()
  const { clearAllChats } = useChat()
  const {
    settings,
    updateSettings,
    providers,
    models,
    refreshModels,
    isConfigLoading,
    configError,
    modelError,
  } = useSettings()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(user?.theme || 'dark')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const handleSaveProfile = () => {
    updateProfile({
      name: formData.name,
      email: formData.email,
      theme,
    })
    setIsEditing(false)
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    updateProfile({ theme: newTheme })
    // Apply theme
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const handleLogout = () => {
    logout()
    onClose()
  }

  const handleClearChats = () => {
    if (confirm('Are you sure you want to delete all chats? This cannot be undone.')) {
      clearAllChats()
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Settings</DialogTitle>
          <DialogDescription>Manage your account and preferences</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Bot className="w-4 h-4 mr-2" />
              AI
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Account Information</h3>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Full Name</label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email</label>
                    <Input
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      disabled
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSaveProfile} className="bg-gradient-to-r from-primary to-accent">
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        setFormData({ name: user?.name || '', email: user?.email || '' })
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{user?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="mt-4 border-border/50"
                  >
                    Edit Profile
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-6 border-destructive/20 bg-destructive/5">
              <h3 className="text-lg font-semibold mb-4 text-destructive">Danger Zone</h3>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleClearChats}
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 bg-transparent"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Chats
                </Button>
                <Button
                  onClick={handleLogout}
                  className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Theme</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    theme === 'light'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <div className="w-8 h-8 bg-white rounded-md mx-auto mb-2 border border-gray-300"></div>
                  <p className="font-medium text-sm">Light</p>
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <div className="w-8 h-8 bg-gray-900 rounded-md mx-auto mb-2 border border-gray-700"></div>
                  <p className="font-medium text-sm">Dark</p>
                </button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Display Options</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Compact Mode</p>
                    <p className="text-sm text-muted-foreground">Reduce spacing between messages</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Timestamps</p>
                    <p className="text-sm text-muted-foreground">Display message times</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Notification Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Notifications</p>
                    <p className="text-sm text-muted-foreground">Get notified about new responses</p>
                  </div>
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={setNotificationsEnabled}
                  />
                </div>
                {notificationsEnabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Sound</p>
                        <p className="text-sm text-muted-foreground">Play sound on new message</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Desktop Notifications</p>
                        <p className="text-sm text-muted-foreground">Desktop alerts for responses</p>
                      </div>
                      <Switch />
                    </div>
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Model Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a provider and model for responses
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshModels()}
                  className="gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Refresh
                </Button>
              </div>

              {configError && (
                <p className="text-sm text-destructive">
                  {configError}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={settings.provider}
                    onValueChange={value =>
                      updateSettings({ provider: value, model: '' })
                    }
                    disabled={isConfigLoading || providers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map(provider => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  {models.length > 0 ? (
                    <Select
                      value={settings.model}
                      onValueChange={value => updateSettings({ model: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map(model => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={settings.model}
                      onChange={e => updateSettings({ model: e.target.value })}
                      placeholder="Enter model id"
                    />
                  )}
                  {modelError && (
                    <p className="text-xs text-muted-foreground">
                      {modelError}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  value={settings.systemPrompt}
                  onChange={e => updateSettings({ systemPrompt: e.target.value })}
                  placeholder="Optional. Leave blank to use the server default."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Web Search</p>
                  <p className="text-sm text-muted-foreground">
                    Allow live web results in answers
                  </p>
                </div>
                <Switch
                  checked={settings.useWeb}
                  onCheckedChange={checked => updateSettings({ useWeb: checked })}
                />
              </div>
            </Card>

          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
