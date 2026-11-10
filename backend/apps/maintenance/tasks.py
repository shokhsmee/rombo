from celery import shared_task


@shared_task(name="maintenance.send_message", ignore_result=True)
def send_message(kind: str, chat_id: int, text: str, buttons=None) -> None:
    from apps.maintenance import bot

    bot.send(kind, chat_id, text, buttons=buttons)
