# 脚手架来源与裁剪

来源：https://github.com/cookiecutter/cookiecutter-django
固定提交：5d3e4bc6a16f0e1fa439916dc7fa804e185ebae4
生成器：Cookiecutter 2.7.1。生成到独立临时目录后选取后端骨架，未改动参考业务前端。

生成参数：project_slug=dingdong_ca、username_type=username、timezone=Asia/Shanghai、rest_api=DRF、use_docker=y、postgresql_version=17、cloud_provider=None、mail_service=Other SMTP、use_celery=y、use_sentry=n、frontend_pipeline=None、open_source_license=Not open source。

为遵循一期简化原则，保留生成的 manage.py、Celery app 初始化模式、自定义 AbstractUser 和 settings 分层；基于本项目重写 API、权限和本地 PostgreSQL 配置。未启用生成器 post hooks（避免它自动安装整套不需要的部署/邮件依赖）；默认邮箱注册、allauth 页面、个人资料公开视图、文件存储、云端部署样例不纳入当前工程。原模板许可证保存在 COOKIECUTTER_LICENSE。

当前为本地开发版本，生产环境启动明确拒绝；真实短信/供应商及完整部署验收未完成。依赖锁定以 uv.lock 为准。Celery 配置入口保留，M1无异步业务，不启动虚假的worker来声称任务闭环通过。
